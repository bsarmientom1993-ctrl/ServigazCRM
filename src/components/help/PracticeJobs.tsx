"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { advancePractice, createExample, ExampleId, examples, nextPracticeAction, PracticeHistory, restorePractice, practiceProjectLabels } from "@/lib/practice";
const labels = { BORRADOR: "Solicitud nueva", EVALUACION_PENDIENTE: "Visita coordinada", EVALUADO: "Por cotizar", COTIZADO: "Esperando al cliente", APROBADO: "Aceptado por el cliente", ANTICIPO_RECIBIDO: "Anticipo completo", EN_PROCESO: "En ejecución", TERMINADO_TECNICO: "Pendiente de calidad", VALIDADO: "Calidad aprobada", FINALIZADO_FINANCIERO: "Cerrado" };
const amount = (cents: number) => "Bs. " + (cents / 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function PracticeJobs() {
  const { user } = useAuth();
  const [history, setHistory] = useState<PracticeHistory>({});
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<ExampleId | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const key = user ? "servigaz-practice:v1:" + user.id : "";
  useEffect(() => {
    if (!key) return;
    setReady(false);
    try { setHistory(restorePractice(localStorage.getItem(key) || "{}")); } catch { setHistory({}); setStorageBlocked(true); }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready && key) try { localStorage.setItem(key, JSON.stringify(history)); } catch { setStorageBlocked(true); } }, [history, ready, key]);
  const jobs = examples.map(example => (history[example.id] || []).reduce(advancePractice, createExample(example.id)));
  const job = jobs.find(item => item.id === selected);
  const action = job ? nextPracticeAction(job) : null;
  const needsConfirmation = action?.event === "FINALIZAR" || action?.event === "VALIDAR";
  const progress = job ? [
    { label: "Solicitud", done: true },
    ...(!job.direct ? [{ label: "Evaluación", done: !["BORRADOR", "EVALUACION_PENDIENTE"].includes(job.state) }] : []),
    { label: "Presupuesto", done: !["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO"].includes(job.state) },
    { label: "Aceptación", done: job.accepted }, { label: "Anticipo", done: job.paid >= job.minimum },
    { label: job.deliveryOnly ? "Entrega del equipo" : "Ejecución", done: ["TERMINADO_TECNICO", "VALIDADO", "FINALIZADO_FINANCIERO"].includes(job.state) },
    { label: job.deliveryOnly ? "Conformidad" : "Calidad", done: job.quality }, { label: "Saldo cero", done: job.paid === job.total },
    ...(job.projectStage ? [{ label: "Proyecto entregado", done: job.projectStage === "ENTREGADO" }] : []), { label: "Cierre", done: job.closed },
  ] : [];
  return <section id="ejemplos" className="space-y-5 scroll-mt-24" aria-label="Trabajos de ejemplo">
    <div><p className="module-eyebrow">APRENDE HACIENDO</p><h3 className="text-xl font-semibold text-ink">{examples.length} casos con procesos diferentes</h3><p className="text-sm text-muted mt-2">Desde la llegada del cliente hasta la entrega, el seguimiento del proyecto y el cierre. Clientes, técnicos e importes ficticios; cada caso comienza en una situación diferente y conserva su progreso.</p></div>
    {storageBlocked && <p className="module-note">Tu navegador no permite guardar el progreso. Puedes practicar durante esta sesión.</p>}
    {message && <p role="status" className="module-success">{message}</p>}{error && <p role="alert" className="module-error">{error}</p>}
    {!ready ? <p role="status" className="module-note">Preparando trabajos de ejemplo…</p> : !job ? <div className="grid sm:grid-cols-2 gap-4">{jobs.map(item => <article key={item.id} className="module-card space-y-4"><div className="flex justify-between gap-2 text-[10px] font-semibold text-muted"><span>{item.code}</span><span className="text-[#F06529]">PRÁCTICA</span></div><h4 className="text-lg font-semibold text-ink">{item.service}</h4><p className="text-sm text-secondary">{item.description}</p><p className="text-xs text-muted">Estado: {labels[item.state]} · {item.customer}</p><button type="button" className="primary-action" onClick={() => { setSelected(item.id); setMessage(""); setError(""); setConfirmed(false); }}>Abrir ejemplo<ArrowRight size={16} /></button></article>)}</div> : <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3"><button type="button" className="theme-toggle" onClick={() => { setSelected(null); setMessage(""); setError(""); }}><ArrowLeft size={16} />Todos los ejemplos</button><button type="button" className="theme-toggle" onClick={() => { setHistory(previous => ({ ...previous, [job.id]: [] })); setConfirmed(false); setError(""); setMessage("Ejemplo reiniciado. Puedes repetirlo desde su situación inicial."); }}><RotateCcw size={15} />Reiniciar este ejemplo</button></div>
      <article className="module-card space-y-5"><div><p className="module-eyebrow">{job.code} · SOLO PRÁCTICA</p><h4 className="text-xl font-semibold text-ink">{job.service}</h4><p className="text-sm text-muted mt-2">{job.customer} · Dirección ficticia · {job.technician || "Técnico por coordinar"}</p></div>
        <ol className="flex flex-wrap gap-2" aria-label="Avance del ejemplo">{progress.map(item => <li key={item.label} className={"flex items-center gap-1.5 text-xs rounded-full px-3 py-2 border " + (item.done ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10" : "border-line text-muted")}><CheckCircle2 size={13} />{item.label}</li>)}</ol>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[{ label: "Presupuesto de ejemplo", value: amount(job.total) }, { label: "Anticipo requerido", value: amount(job.minimum) }, { label: "Pagos simulados", value: amount(job.paid) }, { label: "Saldo simulado", value: amount(job.total - job.paid) }].map(item => <div className="rounded-xl bg-wash p-3" key={item.label}><p className="text-xs text-muted">{item.label}</p><p className="text-base font-semibold text-ink mt-1">{item.value}</p></div>)}</div>
        <p className="text-sm text-secondary">Estado actual: <strong>{labels[job.state]}</strong></p>
        <p className="module-note text-sm">{job.description}</p>
        {job.projectStage && <section className="rounded-xl border border-line p-4 space-y-3" aria-label="Historial exclusivo del proyecto"><div><h5 className="font-semibold text-ink">Proyecto de gas · {practiceProjectLabels[job.projectStage]}</h5><p className="text-xs text-muted mt-1">La instalación y el proyecto tienen seguimientos distintos. El cierre final exige proyecto entregado.</p></div><ol className="space-y-2">{job.projectHistory.map((entry,index)=><li key={index} className="text-sm text-secondary border-l-2 border-[#F06529]/40 pl-3"><span className="text-xs text-muted">Registro {index+1} · </span>{entry}</li>)}</ol></section>}
        {action ? <div className="rounded-xl border border-[#F06529]/30 bg-[#F06529]/5 p-4 space-y-4"><div><p className="module-eyebrow">SIGUIENTE PASO · EN EL SISTEMA REAL: {action.role}</p><h5 className="font-semibold text-ink">{action.label}</h5><p className="text-sm text-secondary mt-2 leading-relaxed">{action.instruction}</p></div>
          {action.event === "COTIZAR" && <p className="text-xs text-muted">Materiales: {amount(job.materialCost)} · Mano de obra: {amount(job.laborCost)} · Transporte: {amount(job.transportCost)}. Son importes ficticios de este caso.</p>}
          {needsConfirmation && <label className="flex items-start gap-2 text-sm text-secondary"><input type="checkbox" className="mt-1 accent-[#F06529]" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{job.deliveryOnly ? "Entiendo que esta venta requiere registrar y verificar la entrega del equipo, sin instalación." : action.event === "FINALIZAR" ? "Entiendo que en una orden real debo adjuntar evidencias antes de finalizar." : "Entiendo que la calidad debe revisarla el encargado, con las evidencias del técnico."}</label>}
          <button type="button" className="primary-action" disabled={needsConfirmation && !confirmed} onClick={() => {
            try { const updated = advancePractice(job, action.event); setHistory(previous => {
              const prior = previous[job.id] || [];
              try { advancePractice(prior.reduce(advancePractice, createExample(job.id)), action.event); return { ...previous, [job.id]: [...prior, action.event] }; } catch { return previous; }
            }); setConfirmed(false); setError(""); setMessage("Paso de práctica completado. Estado: " + labels[updated.state] + ". Saldo simulado: " + amount(updated.total - updated.paid) + "."); } catch (err: any) { setError(err.message); }
          }}>{action.label}<ArrowRight size={16} /></button>
        </div> : <div className="module-success space-y-2"><h5 className="font-semibold">¡Completaste el recorrido!</h5><p>El ejemplo terminó con calidad aprobada y saldo cero.</p><p>Costos ficticios: {amount(job.materialCost + job.laborCost + job.transportCost)} · Utilidad simulada: {amount(job.total - job.materialCost - job.laborCost - job.transportCost)}.</p><p className="text-xs">No se registraron movimientos reales ni se emitió una garantía. Puedes reiniciar el ejemplo para repetirlo.</p></div>}
        <p className="text-xs text-muted">El progreso se guarda en este navegador para tu usuario. No afecta las operaciones reales.</p>
      </article>
    </div>}
  </section>;
}
