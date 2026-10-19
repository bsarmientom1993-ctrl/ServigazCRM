import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "./api";
import { Session } from "./auth";

export const schedulingSchema = z.object({
  duracionMinutos: z.number().int().min(15).max(480).default(60),
  margenMinutos: z.number().int().min(0).max(120).default(30),
  zonaHoraria: z.string().max(100).default("America/La_Paz").refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Zona horaria inválida."),
});
export type Scheduling = z.infer<typeof schedulingSchema>;
export type Reservation = { fechaProgramada: Date; condicionesJson: Prisma.JsonValue | null };
export function reservationEnd(visit: Reservation) {
  const config = (visit.condicionesJson as any)?.agenda;
  const duration = Number.isInteger(config?.duracionMinutos) && config.duracionMinutos >= 15 && config.duracionMinutos <= 480 ? config.duracionMinutos : 60;
  const margin = Number.isInteger(config?.margenMinutos) && config.margenMinutos >= 0 && config.margenMinutos <= 120 ? config.margenMinutos : 30;
  return visit.fechaProgramada.getTime() + (duration + margin) * 60000;
}
export function slotConflicts(start: Date, config: Scheduling, visits: Reservation[]) {
  const end = start.getTime() + (config.duracionMinutos + config.margenMinutos) * 60000;
  return visits.some(visit => start.getTime() < reservationEnd(visit) && end > visit.fechaProgramada.getTime());
}
export function localParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return { day: get("year") + "-" + get("month") + "-" + get("day"), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}
export async function workingHours(tx: Prisma.TransactionClient) {
  const settings = await tx.configuracionPersonal.findFirst({ where: { activo: true }, orderBy: { updatedAt: "desc" } });
  return { inicio: settings?.horaEntrada || "08:30", fin: settings?.horaSalida || "18:00" };
}
export function withinWorkingHours(start: Date, config: Scheduling, hours: { inicio: string; fin: string }) {
  const local = localParts(start, config.zonaHoraria);
  const finish = localParts(new Date(start.getTime() + (config.duracionMinutos + config.margenMinutos) * 60000), config.zonaHoraria);
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return local.day === finish.day && local.minutes >= minutes(hours.inicio) && finish.minutes <= minutes(hours.fin);
}
export async function technicianReservations(tx: Prisma.TransactionClient, ids: string[], start: Date, end: Date) {
  return tx.visitaTecnica.findMany({ where: { tecnicoId: { in: ids }, completada: false,
    fechaProgramada: { gte: new Date(start.getTime() - 12 * 3600000), lt: end },
    trabajo: { estado: { notIn: ["CANCELADO", "ARCHIVADO", "RECHAZADO", "FINALIZADO_FINANCIERO"] } } },
    select: { id: true, tecnicoId: true, fechaProgramada: true, condicionesJson: true } });
}
export async function assertTechnicianSlot(tx: Prisma.TransactionClient, user: Session, id: string, start: Date, config: Scheduling) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Usuario" WHERE id = ${id} FOR UPDATE`);
  const technician = await tx.usuario.findUnique({ where: { id } });
  if (!technician || technician.rol !== "TECNICO_FIJO" || technician.estado !== "ACTIVO" || (user.rol !== "ADMIN" && technician.sucursalId !== user.sucursalId)) throw new ApiError(400, "Selecciona un técnico activo de tu sucursal.");
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) throw new ApiError(400, "Selecciona una fecha y hora futura.");
  if (!withinWorkingHours(start, config, await workingHours(tx))) throw new ApiError(409, "El horario está fuera de la jornada de trabajo. Consulta la agenda.");
  const day = localParts(start, config.zonaHoraria).day;
  const leave = await tx.permisoPersonal.count({ where: { usuarioId: id, estado: "APROBADO", fechaPermiso: new Date(day + "T00:00:00Z") } });
  if (leave) throw new ApiError(409, "El técnico tiene un permiso aprobado ese día. Selecciona otro horario o técnico.");
  const visits = await technicianReservations(tx, [id], start, new Date(start.getTime() + (config.duracionMinutos + config.margenMinutos) * 60000));
  if (slotConflicts(start, config, visits)) throw new ApiError(409, "Ese horario acaba de ocuparse. Consulta de nuevo la agenda y selecciona una alternativa.");
}
