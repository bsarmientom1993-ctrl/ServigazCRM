import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MetodoPago, EstadoTrabajo } from "@prisma/client";
import { managers, requireSession } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { withWork } from "@/lib/workflow";
import { cents, money, paymentResult } from "@/lib/workflow-policy";

const schema = z.object({
  monto: z.number().finite().positive(),
  metodoPago: z.nativeEnum(MetodoPago),
  numeroReferencia: z.string().trim().max(200).optional().default(""),
  comprobanteUrl: z.string().url().max(2000).nullish(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, ["ADMIN","ENCARGADO","CAJA"]);
    const { id } = await params;
    const key = z.string().uuid("Falta una clave válida para evitar cobros duplicados.").parse(req.headers.get("Idempotency-Key"));
    const body = schema.parse(await req.json());
    const amount = cents(body.monto);
    const result = await withWork(id, user, async (tx, actor) => {
      // The client UUID is the payment primary key; no schema migration is needed.
      const previous = await tx.pago.findUnique({ where: { id: key } });
      if (previous && (previous.trabajoId !== id || cents(previous.monto) !== amount ||
        previous.metodoPago !== body.metodoPago || previous.numeroReferencia !== body.numeroReferencia ||
        previous.comprobanteUrl !== (body.comprobanteUrl || null) || previous.registradoPorId !== user.id)) {
        throw new ApiError(409, "Esta clave de cobro ya se usó con otros datos.");
      }
      const work = await tx.trabajo.findUniqueOrThrow({
        where: { id },
        include: { cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 }, pagos: true, egreso: true },
      });
      const quote = work.cotizaciones[0];
      const paid = work.pagos.reduce((sum, p) => sum + cents(p.monto), 0);
      if (previous) return { success: true, pago: previous, nuevoEstado: work.estado, totalPagado: paid / 100,
        saldoPendiente: quote ? Math.max(0, cents(quote.totalCotizado) - paid) / 100 : 0, yaRegistrado: true };
      if (work.egreso) throw new ApiError(409, "El cierre financiero está bloqueado.");
      if (!quote || !["VIGENTE", "APROBADA"].includes(quote.estado)) throw new ApiError(409, "No hay una cotización válida para cobrar.");
      if (quote.estado === "VIGENTE" && quote.fechaVencimiento < new Date()) throw new ApiError(409, "La cotización venció. Emite una nueva versión.");
      const outcome = paymentResult(work.estado, cents(quote.totalCotizado), cents(quote.anticipoMinimoRequerido), paid, amount);
      const pago = await tx.pago.create({ data: {
        id: key, trabajoId: id, tipoPago: outcome.type, monto: money(amount), metodoPago: body.metodoPago,
        numeroReferencia: body.numeroReferencia, comprobanteUrl: body.comprobanteUrl || null, registradoPorId: user.id,
      } });
      await tx.trabajo.update({ where: { id }, data: { estado: outcome.nextState as EstadoTrabajo } });
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "PAGOS", accion: "CREATE", entidadTipo: "Pago", entidadId: pago.id,
        valoresNuevos: { realizadoPor: actor.nombre, trabajoId: id, cotizacionId: quote.id, monto: money(amount), tipoPago: outcome.type, nuevoEstadoTrabajo: outcome.nextState },
      } });
      return { success: true, pago, nuevoEstado: outcome.nextState, totalPagado: outcome.accumulated / 100, saldoPendiente: outcome.remaining / 100 };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
