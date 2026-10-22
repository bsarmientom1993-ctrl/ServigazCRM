export const agendaZone = "America/La_Paz";
export function agendaDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: agendaZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
export function shiftAgendaDay(day: string, amount: number) { const date = new Date(day + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
export function agendaTiming(value: unknown) {
  const config = (value as any)?.agenda;
  return { duracion: Number.isInteger(config?.duracionMinutos) && config.duracionMinutos >= 15 && config.duracionMinutos <= 480 ? config.duracionMinutos : 60, traslado: Number.isInteger(config?.margenMinutos) && config.margenMinutos >= 0 && config.margenMinutos <= 120 ? config.margenMinutos : 30 };
}
export function activeAssignedVisit<T extends { id: string; tecnicoId: string; completada: boolean; fechaProgramada: string | Date }>(visits: T[], technicianId?: string, requestedId = ""): T | undefined {
  const pending = visits.filter(visit => !visit.completada && (!technicianId || visit.tecnicoId === technicianId));
  return requestedId ? pending.find(visit => visit.id === requestedId) : pending.sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime())[0];
}
