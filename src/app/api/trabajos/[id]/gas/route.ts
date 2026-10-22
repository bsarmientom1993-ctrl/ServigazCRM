import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { agendaDay } from "@/lib/technician-agenda";
import { withWork } from "@/lib/workflow";
import { calculateGas, evaluationFingerprint, gasRatesSchema } from "@/lib/gas-policy";
import { gasData, GasReview, isGasWork, newGasProject, objectRecord, projectStages, projectTransitions } from "@/lib/gas-data";
const documentUrl = z.string().url().max(2000).refine(value => /^https?:\/\//i.test(value), "Usa enlaces HTTP o HTTPS.");
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers); const { id } = await params;
    const body = z.discriminatedUnion("accion", [
      z.object({ accion: z.literal("REVISAR_MEDICION"), visitaId: z.string().min(1), decision: z.enum(["APROBAR", "CORREGIR"]), criterio: z.string().trim().min(10).max(3000), tarifas: gasRatesSchema.optional() }),
      z.object({ accion: z.literal("INCLUIR_PROYECTO"), incluido: z.boolean() }),
      z.object({ accion: z.literal("ACTUALIZAR_PROYECTO"), estado: z.enum(projectStages), responsable: z.string().trim().max(150), fechaObjetivo: z.string().date().or(z.literal("")), referencia: z.string().trim().max(200), observaciones: z.string().trim().min(5).max(3000), documentosUrls: z.array(documentUrl).max(20) }),
    ]).parse(await req.json());
    const result = await withWork(id, user, async (tx, actor) => {
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id }, include: { pagos: true, egreso: true, cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1 } } });
      if (!isGasWork(work)) throw new ApiError(400, "Este seguimiento corresponde a trabajos de gas.");
      const metadata = objectRecord(work.fechasSla), gas = structuredClone(gasData(work)), project = gas.proyecto || newGasProject(false);
      const now = new Date().toISOString();
      if (body.accion === "ACTUALIZAR_PROYECTO") {
        if (!project.incluido) throw new ApiError(409, "El trabajo no incluye proyecto de gas.");
        if (body.estado !== project.estado && !projectTransitions[project.estado].includes(body.estado)) throw new ApiError(409, "El proyecto debe avanzar desde su etapa actual. Registra las observaciones antes de volver a elaborar.");
        const updated = { ...project, ...body, actualizado: now, ultimoSeguimiento: agendaDay(), ...(body.estado === "ENTREGADO" ? { proximoSeguimiento: "" } : {}) }; const { accion, ...saved } = updated;
        gas.proyecto = saved;
      } else {
        if (!["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado) || work.egreso || work.pagos.length || work.cotizaciones[0]?.estado === "APROBADA") throw new ApiError(409, "El alcance y la revisión se fijan antes de aceptar o cobrar la cotización.");
        if (body.accion === "INCLUIR_PROYECTO") {
          if (project.incluido === body.incluido) return { success: true, gas };
          gas.proyecto = { ...project, incluido: body.incluido, actualizado: now };
          delete gas.calculo;
          if (gas.supervision) gas.supervision = { ...gas.supervision, estado: "PENDIENTE" };
        } else {
          if (!["EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado)) throw new ApiError(409, "Espera a que el técnico complete la evaluación.");
          const visit = await tx.visitaTecnica.findFirst({ where: { trabajoId: id, completada: true }, orderBy: [{ fechaEjecutada: "desc" }, { createdAt: "desc" }] });
          if (!visit || visit.id !== body.visitaId) throw new ApiError(409, "Revisa la evaluación más reciente de esta orden.");
          if (visit.tecnicoId === user.id) throw new ApiError(403, "El visto bueno debe darlo una persona distinta del técnico que midió.");
          const supervisor = await tx.usuario.findUnique({ where: { id: user.id }, select: { nombre: true } });
          const measurements = objectRecord(visit.medidasJson);
          const review: GasReview = { estado: body.decision === "APROBAR" ? "APROBADO" : "CORRECCION_SOLICITADA", visitaId: visit.id, huella: evaluationFingerprint(visit), supervisorId: user.id, supervisorNombre: supervisor?.nombre || "Supervisor", fecha: now, criterio: body.criterio, metrosVisto: Number(measurements.metrosVisto || 0), metrosEmpotrado: Number(measurements.metrosEmpotrado || 0), incluyeProyecto: project.incluido,
            tarifas: body.tarifas || { materialVisto: 0, materialEmpotrado: 0, manoObraVisto: 0, manoObraEmpotrado: 0, factorManoObra: 1, importeProyecto: 0 } };
          const previous = gas.supervision;
          if (previous?.estado === "APROBADO" && review.estado === "APROBADO" && previous.supervisorId === user.id && previous.visitaId === review.visitaId && previous.huella === review.huella && previous.incluyeProyecto === review.incluyeProyecto && previous.criterio === review.criterio && (Object.keys(review.tarifas) as (keyof typeof review.tarifas)[]).every(key => previous.tarifas[key] === review.tarifas[key])) return { success: true, gas };
          if (body.decision === "APROBAR") { if (!body.tarifas) throw new ApiError(400, "Revisa las tarifas por metro antes del visto bueno."); const calculation = calculateGas(review); gas.calculo = calculation; if (Number(calculation.subtotalMateriales) + Number(calculation.subtotalManoObra) <= 0) throw new ApiError(400, "Define un importe válido para la instalación."); }
          else { delete gas.calculo; await tx.visitaTecnica.update({ where: { id: visit.id }, data: { completada: false } }); }
          gas.supervision = review;
        }
        await tx.cotizacion.updateMany({ where: { trabajoId: id, estado: "VIGENTE" }, data: { estado: "SUPERADA" } });
      }
      const state = body.accion === "ACTUALIZAR_PROYECTO" ? work.estado : body.accion === "REVISAR_MEDICION" && body.decision === "CORREGIR" ? "EVALUACION_PENDIENTE" : ["COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado) ? "EVALUADO" : work.estado;
      gas.aplica = true;
      await tx.trabajo.update({ where: { id }, data: { fechasSla: JSON.parse(JSON.stringify({ ...metadata, gas })), estado: state } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: body.accion === "REVISAR_MEDICION" ? "SUPERVISION_GAS" : "PROYECTO_GAS", accion: "UPDATE", entidadTipo: body.accion === "REVISAR_MEDICION" ? "Trabajo" : "ProyectoGas", entidadId: id, valoresAnteriores: JSON.parse(JSON.stringify(body.accion === "REVISAR_MEDICION" ? { gas: gasData(work) } : { proyecto: gasData(work).proyecto })), valoresNuevos: JSON.parse(JSON.stringify({ realizadoPor: actor.nombre, accion: body.accion, ...(body.accion === "REVISAR_MEDICION" ? { gas } : { proyecto: gas.proyecto }), estado: state })) } });
      return { success: true, gas };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
