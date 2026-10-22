"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gasData, newGasProject, objectRecord, projectLabels } from "@/lib/gas-data";
import { ClipboardCheck, FileText } from "lucide-react";
export function GasWorkflow({ work, canManage, onSaved }: { work: any; canManage: boolean; onSaved: () => Promise<void> }) {
  const gas = gasData(work), project = gas.proyecto || newGasProject(false), review = gas.supervision;
  const visit = [...(work.visitas || [])].filter(v => v.completada).sort((a, b) => new Date(b.fechaEjecutada).getTime() - new Date(a.fechaEjecutada).getTime())[0];
  const measure = objectRecord(visit?.medidasJson);
  const [criterion, setCriterion] = useState("");
  const [rates, setRates] = useState({ materialVisto: 0, materialEmpotrado: 0, manoObraVisto: 0, manoObraEmpotrado: 0, factorManoObra: 1, importeProyecto: 0 });

  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false); const busy = useRef(false);
  useEffect(() => { if (review) { setCriterion(review.criterio); setRates(review.tarifas); } }, [work.id, review?.fecha, project.actualizado]);
  async function save(data: unknown, success: string) {
    if (busy.current) return; busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/trabajos/" + work.id + "/gas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "No se pudo guardar."); await onSaved(); setMessage(success);
    } catch (err: any) { setError(err.message); } finally { busy.current = false; setSaving(false); }
  }
  const editable = canManage && !work.egreso && !work.pagos?.length && work.cotizaciones?.[0]?.estado !== "APROBADA" && ["BORRADOR", "EVALUACION_PENDIENTE", "EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado);
  const canReview = editable && visit && ["EVALUADO", "COTIZADO", "COTIZACION_VENCIDA", "EN_NEGOCIACION"].includes(work.estado);
  return <section className="space-y-4" aria-label="Supervisión y proyecto de gas">
    {error && <p role="alert" className="module-error">{error}</p>}{message && <p role="status" className="module-success">{message}</p>}
    <div className="module-card space-y-4"><h3 className="font-semibold text-ink flex items-center gap-2"><ClipboardCheck size={19} className="text-[#F06529]" />Medición y visto bueno del supervisor</h3>
      {visit ? <p className="module-note">Medición del técnico {visit.tecnico?.nombre || "asignado"}: <strong>{Number(measure.metrosVisto || 0)} m vistos + {Number(measure.metrosEmpotrado || 0)} m empotrados</strong>. El presupuesto se calcula desde esta medición, con las tarifas y el criterio aprobados.</p> : <p className="module-note">El técnico debe completar la visita y registrar los metros lineales antes del visto bueno.</p>}
      {review && <div className={review.estado === "APROBADO" ? "module-success" : "module-note"}><strong>{review.estado === "APROBADO" ? "Visto bueno registrado" : review.estado === "CORRECCION_SOLICITADA" ? "Correcciones solicitadas al técnico" : "Revisión pendiente"}</strong><p>{review.supervisorNombre} · {new Date(review.fecha).toLocaleString("es")}</p><p className="whitespace-pre-wrap">{review.criterio}</p></div>}
      {canManage && review?.estado === "APROBADO" && gas.calculo && <div className="grid sm:grid-cols-3 gap-3 text-sm text-secondary"><p>Materiales: <strong>Bs. {gas.calculo.subtotalMateriales}</strong></p><p>Mano de obra: <strong>Bs. {gas.calculo.manoObraLineal}</strong></p><p>Promedio de instalación: <strong>Bs. {gas.calculo.promedioPorMetro}/m</strong></p><p className="sm:col-span-3 text-xs text-muted">El promedio incluye materiales y mano de obra de los metros aprobados. Proyecto y transporte se muestran por separado.</p></div>}
      {canReview && <form className="space-y-4" onSubmit={e => { e.preventDefault(); save({ accion: "REVISAR_MEDICION", decision: "APROBAR", visitaId: visit.id, criterio: criterion, tarifas: rates }, "Visto bueno registrado. Ya puedes revisar y emitir la carta de cotización."); }}><fieldset disabled={saving} className="space-y-4"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[{ key: "materialVisto", label: "Material por metro visto (Bs./m)" }, { key: "materialEmpotrado", label: "Material por metro empotrado (Bs./m)" }, { key: "manoObraVisto", label: "Mano de obra por metro visto (Bs./m)" }, { key: "manoObraEmpotrado", label: "Mano de obra por metro empotrado (Bs./m)" }, { key: "factorManoObra", label: "Factor de dificultad de mano de obra" }, ...(project.incluido ? [{ key: "importeProyecto", label: "Proyecto (Bs.; 0 si está incluido)" }] : [])].map(field => <label className="form-label" key={field.key}>{field.label}<input required type="number" min={field.key === "factorManoObra" ? 1 : 0} max={field.key === "factorManoObra" ? 5 : 99999999.99} step="0.01" className="module-input mt-2" value={rates[field.key as keyof typeof rates]} onChange={e => setRates({ ...rates, [field.key]: Number(e.target.value) })} /></label>)}</div>
        <label className="form-label block">Criterio y observaciones del supervisor<textarea required minLength={10} maxLength={3000} rows={3} className="module-input mt-2" value={criterion} onChange={e => setCriterion(e.target.value)} placeholder="Revisión de los metros, condiciones de la instalación y justificación del factor aplicado." /></label>
        <div className="flex flex-wrap gap-3"><button className="primary-action" type="submit">Dar visto bueno</button><button className="theme-toggle" type="button" onClick={() => { if (criterion.trim().length < 10) { setError("Describe qué debe corregir el técnico (al menos 10 caracteres)."); return; } save({ accion: "REVISAR_MEDICION", decision: "CORREGIR", visitaId: visit.id, criterio: criterion }, "La evaluación volvió al técnico para corregirla. Las cotizaciones pendientes se reemplazarán después de la nueva revisión."); }}>Solicitar corrección al técnico</button></div>
      </fieldset></form>}
    </div>
    <div className="module-card space-y-4"><h3 className="font-semibold text-ink flex items-center gap-2"><FileText size={19} className="text-[#F06529]" />Proyecto de gas</h3>
      <label className="flex items-start gap-3 text-sm text-secondary"><input type="checkbox" className="mt-1 accent-[#F06529]" checked={project.incluido} disabled={!editable || saving} onChange={e => save({ accion: "INCLUIR_PROYECTO", incluido: e.target.checked }, "Alcance actualizado. Revisa nuevamente el visto bueno antes de cotizar.")} /><span>La instalación incluye proyecto<small className="block text-muted mt-1">Si cambia el alcance, se revisa el presupuesto antes de aceptar o cobrar.</small></span></label>
      {!project.incluido && <p className="module-note">Sin proyecto: instalación menor o alcance sin expediente, según lo definido por el encargado. No se exige entrega de proyecto para cerrar este trabajo.</p>}
      {project.incluido && <><p className={project.estado === "ENTREGADO" ? "module-success" : "module-note"}><strong>{projectLabels[project.estado]}</strong> · {project.responsable || "Responsable por asignar"}{project.fechaObjetivo ? " · Fecha objetivo: " + project.fechaObjetivo : ""}<span className="block text-xs">El proyecto debe estar entregado antes del cierre final de la instalación.</span></p>
        {!canManage && <p className="module-note whitespace-pre-wrap">{project.referencia && "Referencia: " + project.referencia + "\n"}{project.observaciones}</p>}
        {canManage && <Link className="primary-action inline-flex" href={"/proyectos/" + work.id}>Abrir seguimiento e historial del proyecto</Link>}
        {project.documentosUrls.map((url, index) => /^https?:\/\//i.test(url) && <a className="inline-block mr-3 text-sm text-[#F06529] underline" key={url} href={url} target="_blank" rel="noopener noreferrer">Documento {index + 1}</a>)}
      </>}

    </div>
  </section>;
}
