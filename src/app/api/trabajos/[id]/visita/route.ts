import { gasData, isGasWork, objectRecord } from "@/lib/gas-data";
import { assertTechnicianSlot, schedulingSchema } from "@/lib/scheduling";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { withWork } from "@/lib/workflow";

const photo = z.string().url().max(2000).refine(url => /^https?:\/\//.test(url), "Usa un enlace HTTP o HTTPS.").refine(url => !url.includes("unsplash.com"), "Usa fotografías del trabajo.");
const evaluation = z.object({
  visitaId: z.string().min(1),
  medidasJson: z.object({ metrosVisto: z.number().finite().nonnegative(), metrosEmpotrado: z.number().finite().nonnegative() }),
  condicionesJson: z.object({ condiciones: z.string().trim().min(5).max(3000) }),
  ventilacionVasaOk: z.boolean().optional(),
  fotosUrls: z.array(photo).min(3, "Adjunta al menos tres fotos de la visita.").max(20),
  dificultadSugerida: z.number().int().min(1).max(5),
  observaciones: z.string().trim().max(3000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req);
    const { id } = await params;
    const body = await req.json();
    const action = z.enum(["AGENDAR_VISITA", "COMPLETAR_VISITA", "GUARDAR_EVALUACION"]).parse(body.accion);
    if (action === "AGENDAR_VISITA" && !managers.includes(user.rol)) throw new ApiError(403, "El encargado debe programar la visita.");
    const result = await withWork(id, user, async (tx, actor) => {
      const work = await tx.trabajo.findUniqueOrThrow({ where: { id } });
      if (action === "AGENDAR_VISITA") {
        if (!["BORRADOR", "EVALUACION_PENDIENTE", "COTIZADO", "APROBADO", "PAGO_A_CUENTA_RECIBIDO", "ANTICIPO_RECIBIDO"].includes(work.estado)) throw new ApiError(409, "No se puede programar en este estado.");
        const data = z.object({
          tecnicoId: z.string().min(1), fechaProgramada: z.string().datetime({ offset: true }),
          agenda: schedulingSchema.optional(),
          observaciones: z.string().trim().max(3000).optional(),
        }).parse(body);
        const agenda = schedulingSchema.parse(data.agenda || {});
        await assertTechnicianSlot(tx, user, data.tecnicoId, new Date(data.fechaProgramada), agenda);
        const visit = await tx.visitaTecnica.create({ data: {
          trabajoId: id, tecnicoId: data.tecnicoId, fechaProgramada: new Date(data.fechaProgramada), observaciones: data.observaciones, condicionesJson: { agenda },
        } });
        const state = ["BORRADOR", "EVALUACION_PENDIENTE"].includes(work.estado) ? "EVALUACION_PENDIENTE" : work.estado;
        await tx.trabajo.update({ where: { id }, data: { tecnicoId: data.tecnicoId, estado: state } });
        await tx.auditoriaLog.create({ data: {
          usuarioId: user.id, modulo: "TRABAJOS", accion: "UPDATE", entidadTipo: "Trabajo", entidadId: id,
          valoresNuevos: { realizadoPor: actor.nombre, accion: action, visitaId: visit.id, tecnicoId: data.tecnicoId, fechaProgramada: data.fechaProgramada },
        } });
        return { success: true, visita: visit };
      }
      if (work.estado !== "EVALUACION_PENDIENTE") throw new ApiError(409, "La orden no está pendiente de evaluación.");
      const data = evaluation.parse(body);
      const visit = await tx.visitaTecnica.findFirst({ where: { id: data.visitaId, trabajoId: id, completada: false } });
      if (!visit) throw new ApiError(409, "La visita no pertenece a esta orden o ya fue completada.");
      if (user.rol === "TECNICO_FIJO" && visit.tecnicoId !== user.id) throw new ApiError(403, "No tienes asignada esta visita.");
      const subtype = await tx.catalogoSubtipo.findUnique({ where: { codigo: work.subtipoCodigo }, include: { categoria: true } });
      const isGas = subtype?.categoria.codigo === "GAS" || work.subtipoCodigo.startsWith("1.1.") || work.subtipoNombre.toLowerCase().includes("gas");
      if (isGas && data.ventilacionVasaOk !== true) throw new ApiError(400, "Confirma la revisión de ventilación antes de completar la visita de gas.");
      await tx.visitaTecnica.update({ where: { id: visit.id }, data: {
        fechaEjecutada: new Date(), medidasJson: data.medidasJson, condicionesJson: { ...objectRecord(visit.condicionesJson), ...data.condicionesJson },
        ventilacionVasaOk: data.ventilacionVasaOk ?? null, fotosUrls: data.fotosUrls,
        dificultadSugerida: data.dificultadSugerida, observaciones: data.observaciones, completada: true,
      } });
      const gas = gasData(work);
      if (isGasWork(work) && gas.supervision) { gas.supervision = { ...gas.supervision, estado: "PENDIENTE" }; delete gas.calculo; }
      const trabajo = await tx.trabajo.update({ where: { id }, data: {
        ...(isGasWork(work) ? { fechasSla: JSON.parse(JSON.stringify({ ...objectRecord(work.fechasSla), gas: { ...gas, aplica: true } })) } : {}),
        estado: "EVALUADO", dificultadNivel: data.dificultadSugerida, requiereInstaladorExtra: data.dificultadSugerida >= 4,
      } });
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "TRABAJOS", accion: "UPDATE", entidadTipo: "Trabajo", entidadId: id,
        valoresNuevos: { realizadoPor: actor.nombre, accion: action, estado: "EVALUADO", visitaId: visit.id },
      } });
      return user.rol === "TECNICO_FIJO" ? { success: true, trabajo: { id: trabajo.id, estado: trabajo.estado } } : { success: true, trabajo };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
