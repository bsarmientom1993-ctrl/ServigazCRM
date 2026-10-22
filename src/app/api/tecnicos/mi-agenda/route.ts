import { NextRequest, NextResponse } from "next/server";
import { EstadoTrabajo } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { agendaDay, agendaTiming, agendaZone, shiftAgendaDay } from "@/lib/technician-agenda";
import { objectRecord } from "@/lib/gas-data";
const finished: EstadoTrabajo[] = ["TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO"];
const cancelled: EstadoTrabajo[] = ["CANCELADO", "RECHAZADO", "ARCHIVADO"];
export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req, ["TECNICO_FIJO"]);
    const input = z.object({ fecha: z.string().date(), dias: z.coerce.number().int().refine(value => value === 1 || value === 7, "Selecciona un día o siete días.") }).parse({ fecha: req.nextUrl.searchParams.get("fecha") || agendaDay(), dias: req.nextUrl.searchParams.get("dias") || 1 });
    const from = new Date(input.fecha + "T00:00:00-04:00"), until = new Date(shiftAgendaDay(input.fecha, input.dias) + "T00:00:00-04:00");
    const [visits, unplanned] = await Promise.all([
      prisma.visitaTecnica.findMany({
        where: { tecnicoId: user.id, trabajo: { tecnicoId: user.id }, fechaProgramada: { gte: new Date(from.getTime() - 10 * 3600000), lt: until } },
        orderBy: [{ fechaProgramada: "asc" }, { id: "asc" }],
        select: { id: true, fechaProgramada: true, completada: true, condicionesJson: true, observaciones: true,
          trabajo: { select: { id: true, codigoCorrelativo: true, subtipoNombre: true, tipoFlujo: true, estado: true, observaciones: true, fechasSla: true,
            cliente: { select: { nombreCompleto: true, direccion: true, telefonos: true, ubicacionMapsUrl: true } },
            encargado: { select: { nombre: true, telefono: true } },
          } },
        },
      }),
      prisma.trabajo.findMany({
        where: { tecnicoId: user.id, estado: { notIn: [...finished, ...cancelled] }, visitas: { none: { tecnicoId: user.id, completada: false } } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, codigoCorrelativo: true, subtipoNombre: true, estado: true, cliente: { select: { nombreCompleto: true } }, encargado: { select: { nombre: true, telefono: true } } },
      }),
    ]);
    const now = Date.now();
    const visitas = visits.map(visit => {
      const timing = agendaTiming(visit.condicionesJson), end = new Date(visit.fechaProgramada.getTime() + timing.duracion * 60000);
      return { id: visit.id, inicio: visit.fechaProgramada, fin: end, libreDesde: new Date(end.getTime() + timing.traslado * 60000), ...timing,
        estado: cancelled.includes(visit.trabajo.estado) ? "CANCELADA" : visit.completada || finished.includes(visit.trabajo.estado) ? "COMPLETADA" : end.getTime() < now ? "VENCIDA" : "PENDIENTE",
        tipo: visit.trabajo.tipoFlujo === "COMPLETO" && (visit.completada || ["BORRADOR", "EVALUACION_PENDIENTE"].includes(visit.trabajo.estado)) ? "Evaluación técnica" : "Atención del servicio",
        observacionesVisita: visit.observaciones, preferenciaCliente: objectRecord(visit.trabajo.fechasSla).preferenciaCliente || null,
        trabajo: { id: visit.trabajo.id, codigoCorrelativo: visit.trabajo.codigoCorrelativo, servicio: visit.trabajo.subtipoNombre, estado: visit.trabajo.estado, indicaciones: visit.trabajo.observaciones, cliente: visit.trabajo.cliente, encargado: visit.trabajo.encargado },
      };
    }).filter(visit => visit.libreDesde.getTime() > from.getTime());
    return NextResponse.json({ fecha: input.fecha, dias: input.dias, zonaHoraria: agendaZone, fechaActual: agendaDay(), visitas, sinProximaVisita: unplanned });
  } catch (error) { return apiError(error); }
}
