"use client";
import { useEffect, useState } from "react";
import { localDateInput } from "@/lib/work-wizard";

type Preference = { fecha: string; desde: string; hasta: string };
type Agenda = { jornada: { inicio: string; fin: string }; zonaHoraria: string; tecnicos: { id: string; nombre: string; permiso: boolean; ocupaciones: { inicio: string; fin: string }[]; horarios: { inicio: string; fin: string }[] }[] };
export default function TechnicianAgenda({ preference, duration, margin, technicianId, selectedDate, onSelect, onClear }: {
  preference: Preference; duration: number; margin: number; technicianId: string; selectedDate: string;
  onSelect: (id: string, date: string) => void; onClear: () => void;
}) {
  const [day, setDay] = useState(preference.fecha || "");
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { if (preference.fecha) setDay(preference.fecha); else { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); setDay(localDateInput(tomorrow).slice(0, 10)); } }, [preference.fecha]);
  useEffect(() => {
    onClear(); setError(""); setAgenda(null);
    if (!day) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const start = new Date(day + "T" + (preference.desde || "00:00"));
    const end = new Date(day + "T" + (preference.hasta || "23:59"));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { setError("Indica un día y un intervalo de preferencia válidos."); setLoading(false); return; }
    const params = new URLSearchParams({ desde: start.toISOString(), hasta: end.toISOString(), duracionMinutos: String(duration), margenMinutos: String(margin), zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone });
    fetch("/api/tecnicos/disponibilidad?" + params, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "No se pudo consultar la agenda."); return body; })
      .then(body => { if (!controller.signal.aborted) setAgenda(body); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The parent callback is stable; availability depends on the requested interval.
  }, [day, preference.desde, preference.hasta, duration, margin, refresh, onClear]);
  const time = (value: string) => new Date(value).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return <section className="space-y-4 rounded-xl border border-line p-4" aria-label="Disponibilidad de todos los técnicos">
    <div className="flex flex-wrap justify-between gap-3 items-end"><label className="form-label">Día a consultar<input type="date" className="module-input mt-2" value={day} min={localDateInput(new Date()).slice(0, 10)} onChange={e => setDay(e.target.value)} /></label><button type="button" className="theme-toggle" onClick={() => setRefresh(n => n + 1)}>Actualizar agenda</button></div>
    <p className="text-xs text-muted">{preference.desde || preference.hasta ? "Preferencia del cliente: " + (preference.desde || "Inicio de jornada") + " – " + (preference.hasta || "Fin de jornada") + ". " : "Consulta de toda la jornada. "}Duración estimada: {duration} min + {margin} min de traslado. La disponibilidad considera visitas registradas y permisos aprobados.</p>
    {loading && <p role="status" className="module-note">Consultando las agendas de todos los técnicos…</p>}
    {error && <p role="alert" className="module-error">{error} Puedes actualizar la agenda o guardar el trabajo pendiente de coordinación.</p>}
    {agenda && <><p className="text-xs text-muted">Jornada: {agenda.jornada.inicio} – {agenda.jornada.fin} · Zona horaria: {agenda.zonaHoraria}</p><div className="space-y-3">{agenda.tecnicos.map(tech => <article key={tech.id} className="rounded-xl bg-wash p-4 space-y-3"><h4 className="font-semibold text-sm text-ink">{tech.nombre}</h4>
      {tech.permiso ? <p className="text-sm text-muted">No disponible: permiso aprobado.</p> : <>
        <p className="text-xs text-muted">{tech.ocupaciones.length ? "Ocupado (incluye traslado): " + tech.ocupaciones.map(v => time(v.inicio) + "–" + time(v.fin)).join(" · ") : "Sin visitas registradas este día."}</p>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">{tech.horarios.map(slot => { const selected = technicianId === tech.id && selectedDate && new Date(selectedDate).getTime() === new Date(slot.inicio).getTime(); return <button type="button" key={slot.inicio} aria-pressed={!!selected} className={selected ? "primary-action" : "theme-toggle"} onClick={() => onSelect(tech.id, slot.inicio)}>{time(slot.inicio)}–{time(slot.fin)}</button>; })}</div>
        {!tech.horarios.length && <p className="text-sm text-muted">Sin espacios que coincidan con la preferencia y duración indicadas. Consulta otro día o ajusta la preferencia con el cliente.</p>}
      </>}
    </article>)}</div>{!agenda.tecnicos.length && <p className="module-note">No hay técnicos activos asignados a esta sucursal. Puedes guardar pendiente y coordinar después.</p>}</>}
  </section>;
}
