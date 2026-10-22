import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, managers, assertWorkAccess } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withWork } from "@/lib/workflow";
import { gasData, isGasWork, objectRecord, projectStages, projectTransitions } from "@/lib/gas-data";
import { projectEventTypes, projectHistoryEvent, projectHistoryScope } from "@/lib/project-history";
import { agendaDay } from "@/lib/technician-agenda";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers), { id } = await params;
    const work = await prisma.trabajo.findUnique({ where: { id }, select: { id: true, codigoCorrelativo: true, encargadoId: true, tecnicoId: true, sucursalId: true, estado: true, fechasSla: true, subtipoNombre: true, cliente: { select: { nombreCompleto: true } } } });
    if (!work) throw new ApiError(404, "Trabajo no encontrado.");
    assertWorkAccess(user, work);
    if (!isGasWork(work)) throw new ApiError(400, "La orden no corresponde a gas.");
    const cursor = z.string().uuid().optional().parse(req.nextUrl.searchParams.get("cursor") || undefined);
    const where = projectHistoryScope(id);
    if (cursor && !(await prisma.auditoriaLog.findFirst({ where: { AND: [where, { id: cursor }] }, select: { id: true } }))) throw new ApiError(400, "Página de historial inválida.");
    const rows = await prisma.auditoriaLog.findMany({ where, orderBy: [{ timestamp: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, timestamp: true, valoresNuevos: true, usuario: { select: { nombre: true } } } });
    const history = rows.slice(0, 50);
    return NextResponse.json({ trabajo: { id: work.id, codigo: work.codigoCorrelativo, servicio: work.subtipoNombre, cliente: work.cliente.nombreCompleto, estado: work.estado }, proyecto: gasData(work).proyecto || null, historial: history.map(projectHistoryEvent), siguienteCursor: rows.length > 50 ? history[history.length - 1].id : null });
  } catch (error) { return apiError(error); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers), { id } = await params;
    const key = z.string().uuid().parse(req.headers.get("Idempotency-Key"));
    const input = z.object({ tipo: z.enum(projectEventTypes), fechaGestion: z.string().date(), detalle: z.string().trim().min(5).max(3000), estado: z.enum(projectStages), entidad: z.string().trim().max(200), referencia: z.string().trim().max(200), proximoSeguimiento: z.string().date().or(z.literal("")), documentosUrls: z.array(z.string().url().max(2000).refine(url => /^https?:\/\//i.test(url), "Usa enlaces HTTP o HTTPS.")).max(20) }).parse(await req.json());
    if (input.estado === "ENTREGADO") input.proximoSeguimiento = "";
    if (input.fechaGestion > agendaDay()) throw new ApiError(400, "La gestión realizada no puede tener fecha futura.");
    if (input.proximoSeguimiento && input.proximoSeguimiento < input.fechaGestion) throw new ApiError(400, "El próximo seguimiento debe ser igual o posterior a la gestión.");
    const result = await withWork(id, user, async (tx, actor) => {
      const prior = await tx.auditoriaLog.findUnique({ where: { id: key } });
      if (prior) {
        if (prior.entidadTipo !== "ProyectoGas" || prior.entidadId !== id || prior.usuarioId !== user.id || !Object.entries(input).every(([key, value]) => JSON.stringify(objectRecord(objectRecord(prior.valoresNuevos).seguimiento)[key]) === JSON.stringify(value))) throw new ApiError(409, "La solicitud ya se utilizó para otra gestión.");
        return { success: true, yaRegistrado: true };
      }
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id } });
      const metadata = objectRecord(work.fechasSla), gas = structuredClone(gasData(work)), project = gas.proyecto;
      if (!isGasWork(work) || !project?.incluido) throw new ApiError(409, "Esta instalación no incluye proyecto.");
      if (input.estado !== project.estado && !projectTransitions[project.estado].includes(input.estado)) throw new ApiError(409, "La etapa elegida no corresponde al avance actual del proyecto.");
      const updated = { ...project, estado: input.estado, entidad: input.entidad, referencia: input.referencia, actualizado: new Date().toISOString(), ultimoSeguimiento: [project.ultimoSeguimiento || "", input.fechaGestion].sort().pop()!, proximoSeguimiento: input.estado === "ENTREGADO" ? "" : input.proximoSeguimiento };
      // Daily actions do not replace the previous entries, technical review or quotation.
      gas.proyecto = updated;
      await tx.trabajo.update({ where: { id }, data: { fechasSla: JSON.parse(JSON.stringify({ ...metadata, gas })) } });
      await tx.auditoriaLog.create({ data: { id: key, usuarioId: user.id, modulo: "PROYECTO_GAS", accion: "CREATE", entidadTipo: "ProyectoGas", entidadId: id, valoresNuevos: JSON.parse(JSON.stringify({ accion: "REGISTRAR_SEGUIMIENTO", realizadoPor: actor.nombre, seguimiento: input, proyecto: updated })) } });
      return { success: true, yaRegistrado: false };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
