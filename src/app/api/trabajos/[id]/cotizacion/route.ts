import { approvedGasCalculation } from "@/lib/gas-policy";
import { isGasWork } from "@/lib/gas-data";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { withWork } from "@/lib/workflow";
import { cents, money } from "@/lib/workflow-policy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers);
    const { id } = await params;
    const body = z.object({
      subtotalMateriales: z.number().finite().nonnegative(), subtotalManoObra: z.number().finite().nonnegative(),
      montoTransporte: z.number().finite().nonnegative(), porcentajeDescuento: z.number().finite().min(0).max(100).default(0),
      datosFormulario: z.record(z.any()).default({}),
      carta: z.object({ alcance: z.string().trim().min(10).max(5000), condiciones: z.string().trim().max(3000).default(""), fechaValidez: z.string().datetime({ offset: true }) }).optional(),
    }).parse(await req.json());
    const transport = cents(body.montoTransporte);
    const result = await withWork(id, user, async (tx, actor) => {
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id }, include: {
        cliente: true, sucursal: true, cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 }, pagos: true, egreso: true,
      } });
      if (!["EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado) || work.egreso ||
        work.pagos.length > 0 || work.cotizaciones[0]?.estado === "APROBADA") throw new ApiError(409, "No puede reemplazarse el presupuesto de una orden aceptada, cobrada o cerrada.");
      const gasCalculation = isGasWork(work) ? await approvedGasCalculation(tx, work) : null;
      const material = gasCalculation ? cents(gasCalculation.subtotalMateriales) : cents(body.subtotalMateriales);
      const labor = gasCalculation ? cents(gasCalculation.subtotalManoObra) : cents(body.subtotalManoObra);
      const discountConfig = await tx.configuracionDescuento.findFirst({ where: { activo: true } });
      const limit = user.rol === "ADMIN" ? Number(discountConfig?.topeMaximoPct ?? 20) : Number(discountConfig?.pctMaxEncargado ?? 10);
      if (body.porcentajeDescuento > limit) throw new ApiError(403, "El descuento supera el límite autorizado para tu rol.");
      const gross = material + labor + transport;
      const discount = new Prisma.Decimal(gross).mul(body.porcentajeDescuento).div(100).toDecimalPlaces(0).toNumber();
      const total = gross - discount;
      if (total <= 0 || total > 999999999999) throw new ApiError(400, "Revisa el importe total de la cotización.");
      const deposit = await tx.configuracionAnticipo.findUnique({ where: { subtipoCodigo: work.subtipoCodigo } });
      const percentage = deposit?.activo ? Number(deposit.porcentajeMinimo) : work.tipoFlujo === "SIMPLIFICADO" ? 100 : 50;
      if (percentage < 0 || percentage > 100) throw new ApiError(409, "Revisa la configuración del anticipo.");
      const minimum = new Prisma.Decimal(total).mul(percentage).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_CEIL).toNumber();
      const expiry = body.carta ? new Date(body.carta.fechaValidez) : new Date(Date.now() + 15 * 86400000);
      if (expiry.getTime() <= Date.now() || expiry.getTime() > Date.now() + 90 * 86400000) throw new ApiError(400, "La validez debe ser futura y de hasta 90 días.");
      const issuer = actor;
      if (!issuer?.nombre.trim()) throw new ApiError(409, "Completa tu nombre de usuario antes de emitir la cotización.");
      const letter = { cotizadoPorId: user.id, cotizadoPorNombre: issuer.nombre.trim(), alcance: body.carta?.alcance || work.subtipoNombre, condiciones: body.carta?.condiciones || "", clienteNombre: work.cliente?.nombreCompleto || "", clienteDireccion: work.cliente?.direccion || "", clienteEmail: work.cliente?.email || "", servicio: work.subtipoNombre, sucursal: work.sucursal?.nombre || "", emisor: "SERVIGAZ · Equipos e Instalaciones" };
      const version = (work.cotizaciones[0]?.numeroVersion || 0) + 1;
      await tx.cotizacion.updateMany({ where: { trabajoId: id, estado: "VIGENTE" }, data: { estado: "SUPERADA" } });
      const cotizacion = await tx.cotizacion.create({ data: {
        trabajoId: id, numeroVersion: version, tipoVersion: version === 1 ? "ORIGINAL" : "CORRECCION",
        datosFormularioJson: { ...body.datosFormulario, carta: letter },
        snapshotCalculoJson: { origen: gasCalculation ? "MEDICION_GAS_SUPERVISADA" : "PRESUPUESTO_MANUAL", ...(gasCalculation ? { gas: JSON.parse(JSON.stringify(gasCalculation)) } : {}), subtotalMateriales: money(material), subtotalManoObra: money(labor), montoTransporte: money(transport), porcentajeDescuento: body.porcentajeDescuento, porcentajeAnticipo: percentage },
        subtotalMateriales: money(material), subtotalManoObra: money(labor), montoTransporte: money(transport),
        porcentajeDescuento: body.porcentajeDescuento, montoDescuento: money(discount),
        descuentoAprobadoPor: user.rol === "ADMIN" && body.porcentajeDescuento > Number(discountConfig?.pctMaxEncargado ?? 10) ? user.id : null,
        totalCotizado: money(total), anticipoMinimoRequerido: money(minimum), fechaVencimiento: expiry, estado: "VIGENTE",
      } });
      const trabajo = await tx.trabajo.update({ where: { id }, data: { estado: "COTIZADO" } });
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "COTIZACIONES", accion: "CREATE", entidadTipo: "Cotizacion", entidadId: cotizacion.id,
        valoresNuevos: { realizadoPor: actor.nombre, trabajoId: id, numeroVersion: version, totalCotizado: money(total) },
      } });
      return { success: true, cotizacion, trabajo };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
