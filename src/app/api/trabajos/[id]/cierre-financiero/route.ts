import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMonths } from "date-fns";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { withWork } from "@/lib/workflow";
import { cents, money, assertClose } from "@/lib/workflow-policy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers);
    const { id } = await params;
    const body = z.object({
      costoManoObraReal: z.number().finite().nonnegative(),
      costoTransporteReal: z.number().finite().nonnegative(),
    }).parse(await req.json());
    const labor = cents(body.costoManoObraReal);
    const transport = cents(body.costoTransporteReal);
    const result = await withWork(id, user, async (tx) => {
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id }, include: {
        materiales: true, pagos: true, egreso: true, garantia: true,
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 },
      } });
      if (work.egreso) {
        if (work.estado !== "FINALIZADO_FINANCIERO" || !work.garantia) {
          throw new ApiError(409, "El cierre anterior está incompleto. Solicita conciliación al administrador.");
        }
        return { success: true, egreso: work.egreso, utilidadReal: Number(work.egreso.utilidadNeta), garantia: work.garantia, yaCerrado: true };
      }
      const quote = work.cotizaciones[0];
      if (!quote || quote.estado !== "APROBADA") throw new ApiError(409, "Falta la cotización aceptada.");
      const paid = work.pagos.reduce((sum, p) => sum + cents(p.monto), 0);
      assertClose(work.estado, cents(quote.totalCotizado), paid);
      const config = await tx.configuracionGarantia.findUnique({ where: { subtipoCodigo: work.subtipoCodigo } });
      if (!config?.activo || config.mesesDefecto <= 0) throw new ApiError(409, "Configura la garantía del servicio antes del cierre.");
      const consumed = work.materiales.filter(m => m.consumido);
      const inventory = consumed.filter(m => m.tipoOrigen === "INVENTARIO");
      const manual = consumed.filter(m => m.tipoOrigen === "MANUAL_FUERA_INVENTARIO");
      const materials = consumed.reduce((sum, m) => sum + cents(m.subtotalCosto), 0);
      const expense = materials + labor + transport;
      const profit = paid - expense;
      const egreso = await tx.egresoTrabajo.create({ data: {
        trabajoId: id,
        materialesInventarioJson: inventory.map(m => ({ productoId: m.productoId, descripcion: m.descripcion, cantidad: String(m.cantidad), costoUnitario: String(m.costoUnitario), subtotal: String(m.subtotalCosto) })),
        materialesManualesJson: manual.map(m => ({ descripcion: m.descripcion, cantidad: String(m.cantidad), costoUnitario: String(m.costoUnitario), subtotal: String(m.subtotalCosto), proveedor: m.proveedorNombre })),
        manoObraMonto: money(labor), transporteMonto: money(transport), totalEgreso: money(expense),
        totalIngreso: money(paid), utilidadNeta: money(profit), alertaMargenNegativo: profit < 0, bloqueado: true, generadoPor: user.id,
      } });
      const start = new Date();
      const code = "GAR-" + work.codigoCorrelativo;
      const garantia = work.garantia || await tx.certificadoGarantia.create({ data: {
        trabajoId: id, codigoCertificado: code, mesesCobertura: config.mesesDefecto, fechaInicio: start,
        fechaFin: addMonths(start, config.mesesDefecto),
        qrCodeData: new URL("/api/garantias/" + encodeURIComponent(code), req.nextUrl.origin).toString(), activo: true,
      } });
      await tx.trabajo.update({ where: { id }, data: { estado: "FINALIZADO_FINANCIERO" } });
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "CIERRE_FINANCIERO", accion: "CREATE", entidadTipo: "EgresoTrabajo", entidadId: egreso.id,
        valoresNuevos: { trabajoId: id, cotizacionId: quote.id, totalIngreso: money(paid), totalEgreso: money(expense),
          utilidadNeta: money(profit), garantiaId: garantia.id, condicionesGarantia: config.condiciones },
      } });
      return { success: true, egreso, utilidadReal: profit / 100, garantia };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
