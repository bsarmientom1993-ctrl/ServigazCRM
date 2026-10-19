import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { withWork } from "@/lib/workflow";
import { cents } from "@/lib/workflow-policy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers);
    const { id } = await params;
    const body = z.object({
      decision: z.enum(["APROBAR", "APROBADO", "RECHAZAR", "RECHAZADO"]),
      cotizacionId: z.string().min(1),
      motivoRechazo: z.string().trim().max(1000).optional(),
    }).parse(await req.json());
    const result = await withWork(id, user, async (tx) => {
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id }, include: {
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 }, pagos: true, egreso: true,
      } });
      const quote = work.cotizaciones[0];
      if (!quote || quote.id !== body.cotizacionId) throw new ApiError(409, "La cotización cambió. Actualiza la orden.");
      if (work.estado !== "COTIZADO" || quote.estado !== "VIGENTE" || work.egreso) throw new ApiError(409, "La orden no está pendiente de decisión.");
      if (quote.fechaVencimiento < new Date()) throw new ApiError(409, "La cotización venció. Emite una nueva versión.");
      const approved = ["APROBAR", "APROBADO"].includes(body.decision);
      const paid = work.pagos.reduce((sum, p) => sum + cents(p.monto), 0);
      if (!approved && paid > 0) throw new ApiError(409, "La orden tiene cobros. Debe conciliarse la devolución antes de rechazarla.");
      const state = approved ? (paid >= cents(quote.anticipoMinimoRequerido) ? "ANTICIPO_RECIBIDO" :
        paid > 0 ? "PAGO_A_CUENTA_RECIBIDO" : "APROBADO") : "RECHAZADO";
      await tx.cotizacion.update({ where: { id: quote.id }, data: { estado: approved ? "APROBADA" : "RECHAZADA" } });
      const trabajo = await tx.trabajo.update({ where: { id }, data: {
        estado: state, motivoPausa: approved ? null : body.motivoRechazo || "Cotización rechazada por el cliente",
      } });
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "TRABAJOS", accion: "UPDATE", entidadTipo: "Trabajo", entidadId: id,
        valoresAnteriores: { estado: work.estado },
        valoresNuevos: { estado: state, cotizacionId: quote.id, motivo: body.motivoRechazo || null },
      } });
      return { success: true, trabajo };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
