"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { projectLabels, projectStages, projectTransitions, type GasProject, type ProjectStage } from "@/lib/gas-data";
import { projectEventLabels, projectEventTypes } from "@/lib/project-history";
import { agendaDay, agendaZone, shiftAgendaDay } from "@/lib/technician-agenda";
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params), { user, loading: authLoading } = useAuth();
  const allowed = user?.rol === "ADMIN" || user?.rol === "ENCARGADO";
  const [data, setData] = useState<any>(null), [history, setHistory] = useState<any[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(true), [moreLoading, setMoreLoading] = useState(false), [saving, setSaving] = useState(false);
  const busy = useRef(false), requestKey = useRef<string | null>(null);
  const [note, setNote] = useState({ tipo: "SEGUIMIENTO", fechaGestion: agendaDay(), detalle: "", estado: "PENDIENTE" as ProjectStage, entidad: "", referencia: "", proximoSeguimiento: shiftAgendaDay(agendaDay(),1), documents: "" });
  const [edit, setEdit] = useState({ estado: "PENDIENTE" as ProjectStage, responsable: "", fechaObjetivo: "", referencia: "", observaciones: "", documents: "" });
  const load = useCallback(async (next?: string) => {
    const response = await fetch("/api/trabajos/" + id + "/proyecto" + (next ? "?cursor=" + encodeURIComponent(next) : ""));
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "No se pudo cargar el proyecto.");
    setHistory(previous => next ? [...previous, ...body.historial] : body.historial); setCursor(body.siguienteCursor);
    if (!next) {
      setData(body); const project: GasProject | null = body.proyecto;
      if (project) {
        setNote(previous => ({ ...previous, estado: project.estado, entidad: project.entidad || "", referencia: project.referencia || "", proximoSeguimiento: project.proximoSeguimiento || shiftAgendaDay(agendaDay(),1) }));
        setEdit({ estado: project.estado, responsable: project.responsable, fechaObjetivo: project.fechaObjetivo, referencia: project.referencia, observaciones: project.observaciones, documents: (project.documentosUrls || []).join("\n") });
      }
    }
  }, [id]);
  useEffect(() => {
    if (!allowed) return;
    setData(null); setHistory([]); setError(""); setLoading(true);
    load().catch(err => setError(err.message)).finally(()=>setLoading(false));
  }, [allowed, user?.id, load]);
  async function save(path: string, value: unknown, daily: boolean) {
    if (busy.current) return; busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      if (daily && !requestKey.current) requestKey.current = crypto.randomUUID();
      const response = await fetch("/api/trabajos/" + id + "/" + path, { method: "POST", headers: { "Content-Type": "application/json", ...(daily ? { "Idempotency-Key": requestKey.current! } : {}) }, body: JSON.stringify(value) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      if (daily) { requestKey.current = null; setNote(previous=>({ ...previous, detalle: "", documents: "", fechaGestion: agendaDay() })); }
      setMessage(daily ? "Gestión añadida al historial del proyecto." : "Etapa y datos del proyecto actualizados.");
      await load();
    } catch (err: any) { setError(err.message); } finally { busy.current = false; setSaving(false); }
  }
  function changeNote(patch: Partial<typeof note>) { requestKey.current = null; setNote(previous=>({ ...previous, ...patch })); }
  if (authLoading) return <p className="module-note">Cargando sesión…</p>;
  if (!allowed) return <p className="module-note">El historial del proyecto está disponible para encargados y administradores.</p>;
  if (loading) return <p className="module-note" role="status">Consultando expediente e historial…</p>;
  if (!data) return <div className="space-y-3"><p role="alert" className="module-error">{error}</p><button className="theme-toggle" onClick={()=>{ setLoading(true); load().catch(err=>setError(err.message)).finally(()=>setLoading(false)); }}>Reintentar</button></div>;
  const project: GasProject | null = data.proyecto;
  const choices = project ? projectStages.filter(stage=>stage===project.estado || projectTransitions[project.estado].includes(stage)) : [];
  return <div className="max-w-4xl mx-auto space-y-6" aria-busy={saving}>
    <div className="flex flex-wrap gap-3"><Link className="theme-toggle" href="/proyectos">Todos los proyectos</Link><Link className="theme-toggle" href={"/trabajos/"+id}>Ver instalación</Link></div>
    <section className="module-card space-y-3"><p className="module-eyebrow">EXPEDIENTE E HISTORIAL EXCLUSIVO DEL PROYECTO</p><h2 className="text-2xl font-semibold text-ink">{data.trabajo.cliente}</h2><p className="text-sm text-secondary">{data.trabajo.codigo} · {data.trabajo.servicio}</p><p className="text-sm text-secondary">{project?.incluido ? projectLabels[project.estado] : "Sin proyecto incluido"} · Entidad: {project?.entidad || "Por registrar"}</p><p className="text-xs text-muted">El historial conserva cada gestión y corrección con fecha y autor. La instalación mantiene su avance técnico separado. Si incluye proyecto, el cierre final requiere entrega.</p></section>
    {error && <p role="alert" className="module-error">{error}</p>}{message && <p role="status" className="module-success">{message}</p>}
    {project?.incluido ? <>
      <section className="module-card space-y-4"><h3 className="text-lg font-semibold text-ink">Registrar gestión del proyecto</h3><form onSubmit={e=>{ e.preventDefault(); const { documents, ...fields } = note; save("proyecto", { ...fields, documentosUrls: documents.split("\n").map(s=>s.trim()).filter(Boolean) }, true); }}><fieldset disabled={saving} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4"><label className="form-label">Tipo de gestión<select className="module-input mt-2" value={note.tipo} onChange={e=>changeNote({ tipo:e.target.value })}>{projectEventTypes.map(type=><option key={type} value={type}>{projectEventLabels[type]}</option>)}</select></label><label className="form-label">Fecha de la gestión<input className="module-input mt-2" type="date" required max={agendaDay()} value={note.fechaGestion} onChange={e=>changeNote({fechaGestion:e.target.value})}/></label><label className="form-label">Entidad encargada<input className="module-input mt-2" maxLength={200} value={note.entidad} onChange={e=>changeNote({entidad:e.target.value})} placeholder="Nombre de la entidad"/></label><label className="form-label">Referencia del expediente<input className="module-input mt-2" maxLength={200} value={note.referencia} onChange={e=>changeNote({referencia:e.target.value})}/></label><label className="form-label">Etapa después de esta gestión<select className="module-input mt-2" value={note.estado} onChange={e=>changeNote({estado:e.target.value as ProjectStage})}>{choices.map(stage=><option key={stage} value={stage}>{projectLabels[stage]}</option>)}</select></label><label className="form-label">Próximo seguimiento<input className="module-input mt-2" type="date" min={note.fechaGestion} value={note.estado === "ENTREGADO" ? "" : note.proximoSeguimiento} disabled={note.estado === "ENTREGADO"} onChange={e=>changeNote({proximoSeguimiento:e.target.value})}/></label></div>
        <label className="form-label block">Gestión realizada, observación o corrección<textarea required minLength={5} maxLength={3000} rows={4} className="module-input mt-2" value={note.detalle} onChange={e=>changeNote({detalle:e.target.value})} placeholder="Ej.: Se consultó el expediente. Continúa pendiente de revisión. Volver a consultar mañana."/></label>
        <label className="form-label block">Documentos de esta gestión · enlaces, uno por línea<textarea className="module-input mt-2" rows={2} value={note.documents} onChange={e=>changeNote({documents:e.target.value})}/></label><p className="text-xs text-muted">Puedes registrar varias gestiones en la misma etapa. Cada registro permanece en el historial.</p><button className="primary-action" type="submit">Añadir al historial del proyecto</button>
      </fieldset></form></section>
      <details className="module-card"><summary className="font-semibold text-ink cursor-pointer">Cambiar etapa, responsable o documentación general</summary><form className="mt-4" onSubmit={e=>{e.preventDefault(); const { documents,...fields }=edit; save("gas",{accion:"ACTUALIZAR_PROYECTO",...fields,documentosUrls:documents.split("\n").map(s=>s.trim()).filter(Boolean)},false);}}><fieldset className="space-y-4" disabled={saving}><div className="grid sm:grid-cols-2 gap-4"><label className="form-label">Etapa<select className="module-input mt-2" value={edit.estado} onChange={e=>setEdit({...edit,estado:e.target.value as ProjectStage})}>{choices.map(stage=><option key={stage} value={stage}>{projectLabels[stage]}</option>)}</select></label><label className="form-label">Responsable<input className="module-input mt-2" maxLength={150} value={edit.responsable} onChange={e=>setEdit({...edit,responsable:e.target.value})}/></label><label className="form-label">Fecha objetivo · estimada<input className="module-input mt-2" type="date" value={edit.fechaObjetivo} onChange={e=>setEdit({...edit,fechaObjetivo:e.target.value})}/></label><label className="form-label">Referencia<input className="module-input mt-2" maxLength={200} value={edit.referencia} onChange={e=>setEdit({...edit,referencia:e.target.value})}/></label></div><label className="form-label block">Observaciones del cambio<textarea className="module-input mt-2" required minLength={5} maxLength={3000} rows={2} value={edit.observaciones} onChange={e=>setEdit({...edit,observaciones:e.target.value})}/></label><label className="form-label block">Documentación general · enlaces, uno por línea<textarea className="module-input mt-2" rows={2} value={edit.documents} onChange={e=>setEdit({...edit,documents:e.target.value})}/></label><button type="submit" className="primary-action">Guardar datos y etapa</button></fieldset></form></details>
    </> : <p className="module-note">Esta instalación no requiere seguimiento de proyecto según el alcance registrado. Puedes consultar los antecedentes existentes.</p>}
    <section className="module-card space-y-4"><h3 className="text-lg font-semibold text-ink">Historial del proyecto</h3><p className="text-xs text-muted">Registros permanentes · No incluye cotizaciones ni supervisión de las mediciones.</p>{!history.length ? <p className="text-sm text-muted">Aún no hay gestiones registradas.</p> : <ol className="space-y-5">{history.map(event=><li className="border-l-2 border-line pl-4 space-y-2" key={event.id}><p className="font-semibold text-sm text-ink">{projectEventLabels[event.tipo] || "Actualización del proyecto"}{event.estado ? " · "+projectLabels[event.estado as ProjectStage] : ""}</p><p className="text-xs text-muted">{event.fechaGestion ? "Gestión del "+event.fechaGestion+" · " : ""}Registrado: {new Date(event.registradoEn).toLocaleString("es-BO",{timeZone:agendaZone})} · {event.autor}</p><p className="text-sm text-secondary whitespace-pre-wrap break-words">{event.detalle}</p>{(event.entidad || event.referencia) && <p className="text-xs text-muted">{event.entidad} · {event.referencia}</p>}{event.proximoSeguimiento && <p className="text-xs text-muted">Próximo seguimiento: {event.proximoSeguimiento}</p>}<div className="flex flex-wrap gap-3">{event.documentosUrls.filter((url:string)=>/^https?:\/\//i.test(url)).map((url:string,index:number)=><a key={url+index} href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline text-secondary">Documento {index+1}</a>)}</div></li>)}</ol>}{cursor && <button className="theme-toggle" disabled={moreLoading || saving} onClick={async()=>{setMoreLoading(true);setError("");try{await load(cursor);}catch(err:any){setError(err.message);}finally{setMoreLoading(false);}}}>{moreLoading ? "Cargando…" : "Ver registros anteriores"}</button>}</section>
  </div>;
}
