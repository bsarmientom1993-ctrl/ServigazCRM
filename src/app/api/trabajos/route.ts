import { createHash } from "node:crypto";
import { newCustomerSchema } from "@/lib/work-wizard";
import { assertTechnicianSlot, schedulingSchema } from "@/lib/scheduling";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireSession, managers, workScope } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req);
    const estado = req.nextUrl.searchParams.get("estado");
    const tecnicoId = req.nextUrl.searchParams.get("tecnicoId");
    const trabajos = await prisma.trabajo.findMany({
      where: { AND: [workScope(user), ...(estado ? [{ estado: z.enum(["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION", "APROBADO", "PAGO_A_CUENTA_RECIBIDO", "PAGO_A_CUENTA_VENCIDO", "RECHAZADO", "ANTICIPO_RECIBIDO", "EN_PROCESO", "EN_PAUSA", "CANCELADO", "TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO", "ARCHIVADO", "RECLAMO_GARANTIA"]).parse(estado) }] : []), ...(tecnicoId ? [{ tecnicoId }] : [])] },
      include: { cliente: true, tecnico: { select: { id: true, nombre: true, email: true, telefono: true } },
        encargado: { select: { id: true, nombre: true, email: true } },
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 },
        visitas: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(trabajos);
  } catch (error) { return apiError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, managers);
    const requestId = z.string().uuid("Clave de solicitud inválida.").optional().parse(req.headers.get("Idempotency-Key") || undefined);
    const body = z.object({
      clienteId: z.string().min(1).nullish(),
      nuevoCliente: newCustomerSchema.nullish(),
      tipoFlujo: z.enum(["COMPLETO", "SIMPLIFICADO"]).default("COMPLETO"),
      subtipoCodigo: z.string().trim().min(1).max(300), subtipoNombre: z.string().trim().min(1).max(500),
      subtipoCodigos: z.array(z.string().trim().min(1).max(100)).min(1).max(20).optional(),
      detallesCliente: z.string().trim().max(2000).optional(),
      preferenciaCliente: z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")), desde: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), hasta: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }).nullish(),
      agenda: schedulingSchema.optional(),
      observaciones: z.string().trim().max(3000).optional(),
      dificultadNivel: z.number().int().min(1).max(5).default(1),
      tecnicoId: z.string().min(1).nullish(), fechaProgramada: z.string().datetime({ offset: true, message: "Selecciona una fecha válida con zona horaria." }).nullish(),
    }).parse(await req.json());
    if (!body.clienteId && !body.nuevoCliente) throw new ApiError(400, "Selecciona o registra un cliente.");
    if (Boolean(body.tecnicoId) !== Boolean(body.fechaProgramada)) throw new ApiError(400, "Para programar indica técnico y fecha.");
    if (body.fechaProgramada && !Number.isFinite(new Date(body.fechaProgramada).getTime())) throw new ApiError(400, "Fecha inválida.");
    if (body.preferenciaCliente && body.preferenciaCliente.desde >= body.preferenciaCliente.hasta) throw new ApiError(400, "Revisa el intervalo de preferencia del cliente.");
    const fingerprint = createHash("sha256").update(user.id + JSON.stringify(body)).digest("hex");
    const work = await prisma.$transaction(async tx => {
      // Protect the annual sequence without a schema change.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742381)`;
      if (requestId) {
        const previous = await tx.trabajo.findUnique({ where: { id: requestId } });
        if (previous) {
          const audit = await tx.auditoriaLog.findFirst({ where: { entidadId: requestId, entidadTipo: "Trabajo", accion: "CREATE", usuarioId: user.id }, orderBy: { timestamp: "asc" } });
          if (previous.encargadoId !== user.id || (audit?.valoresNuevos as any)?.requestFingerprint !== fingerprint) throw new ApiError(409, "Esta clave ya se utilizó para otra solicitud. Revisa el trabajo creado antes de volver a guardar.");
          return previous;
        }
      }
      const codes = body.subtipoCodigos || body.subtipoCodigo.split("_");
      if (new Set(codes).size !== codes.length || codes.join("_").length > 300) throw new ApiError(400, "Revisa los servicios seleccionados.");
      const subtypes = await tx.catalogoSubtipo.findMany({ where: { codigo: { in: codes }, activo: true }, include: { categoria: true } });
      if (subtypes.length !== codes.length || subtypes.some(s => !s.categoria.activo)) throw new ApiError(400, "Selecciona servicios activos del catálogo.");
      const direct = subtypes.every(s => !s.categoria.requiereVisita);
      if (body.tipoFlujo === "SIMPLIFICADO" && !direct) throw new ApiError(400, "El servicio requiere evaluación previa.");
      const agenda = schedulingSchema.parse(body.agenda || {});
      if (body.tecnicoId && body.fechaProgramada) await assertTechnicianSlot(tx, user, body.tecnicoId, new Date(body.fechaProgramada), agenda);
      let clientId = body.clienteId;
      if (clientId) {
        const client = await tx.cliente.findUnique({ where: { id: clientId } });
        if (!client || (user.rol !== "ADMIN" && client.sucursalId !== user.sucursalId)) throw new ApiError(403, "Cliente fuera de tu sucursal.");
      } else {
        const data = body.nuevoCliente!;
        const client = await tx.cliente.create({ data: { nombreCompleto: data.nombreCompleto, telefonos: [data.telefono], direccion: data.direccion, email: data.email, sucursalId: user.sucursalId } });
        clientId = client.id;
      }
      const prefix = "TRB-" + new Date().getFullYear() + "-";
      const previous = await tx.trabajo.findMany({ where: { codigoCorrelativo: { startsWith: prefix } }, select: { codigoCorrelativo: true } });
      const sequence = previous.reduce((max, w) => Math.max(max, Number(w.codigoCorrelativo.slice(prefix.length)) || 0), 0) + 1;
      const trabajo = await tx.trabajo.create({ data: {
        ...(requestId ? { id: requestId } : {}), codigoCorrelativo: prefix + String(sequence).padStart(4, "0"), clienteId: clientId!, encargadoId: user.id, sucursalId: user.sucursalId,
        tecnicoId: body.tecnicoId || null, tipoFlujo: direct ? "SIMPLIFICADO" : "COMPLETO", subtipoCodigo: codes.join("_"),
        subtipoNombre: subtypes.map(s => s.nombre).join(" + "), observaciones: [body.detallesCliente ? "Detalles del cliente: " + body.detallesCliente : "", body.observaciones || ""].filter(Boolean).join("\n\n"),
        ...(body.preferenciaCliente ? { fechasSla: { preferenciaCliente: body.preferenciaCliente } } : {}),
        dificultadNivel: body.dificultadNivel, requiereInstaladorExtra: body.dificultadNivel >= 4,
        estado: direct ? "EVALUADO" : body.tecnicoId ? "EVALUACION_PENDIENTE" : "BORRADOR",
      } });
      // Direct services go straight to an explicit, reviewed quote; never invent a tariff.
      if (body.tecnicoId && body.fechaProgramada) await tx.visitaTecnica.create({ data: {
        trabajoId: trabajo.id, tecnicoId: body.tecnicoId, fechaProgramada: new Date(body.fechaProgramada),
        observaciones: direct ? "Atención directa del servicio" : "Visita de evaluación", condicionesJson: { agenda },
      } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "TRABAJOS", accion: "CREATE", entidadTipo: "Trabajo", entidadId: trabajo.id,
        valoresNuevos: { codigo: trabajo.codigoCorrelativo, estado: trabajo.estado, servicioDirecto: direct, ...(requestId ? { requestFingerprint: fingerprint } : {}) } } });
      return trabajo;
    }, { timeout: 15000 });
    return NextResponse.json(work, { status: 201 });
  } catch (error) { return apiError(error); }
}
