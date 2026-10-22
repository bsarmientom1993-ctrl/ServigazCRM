"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, MapPin, Search, User, Wrench } from "lucide-react";
import TechnicianAgenda from "@/components/trabajos/TechnicianAgenda";
import { useAuth } from "@/context/AuthContext";
import { Category, Customer, CustomerForm, customerError, emptyCustomer, localDateInput, restoreWizardDraft, selectedServices } from "@/lib/work-wizard";

type Technician = { id: string; nombre: string };
const customerDetails = (client: Customer): CustomerForm => ({ nombreCompleto: client.nombreCompleto, telefono: client.telefonos?.[0] || "", direccion: client.direccion || "", email: client.email || "" });
export default function NuevoTrabajoWizardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [intent, setIntent] = useState<{ clientId: string; newClient: boolean } | null>(null);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setIntent({ clientId: params.get("clienteId") || "", newClient: params.get("nuevoCliente") === "1" }); }, []);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<Category[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>({ ...emptyCustomer });
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [subtypes, setSubtypes] = useState<Record<string, string>>({});
  const [includesGasProject, setIncludesGasProject] = useState(false);
  const [notes, setNotes] = useState("");
  const [details, setDetails] = useState("");
  const [preference, setPreference] = useState({ fecha: "", desde: "", hasta: "" });
  const [duration, setDuration] = useState(60);
  const [margin, setMargin] = useState(30);
  const [schedule, setSchedule] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [reload, setReload] = useState(0);
  const requestKey = useRef("");
  const busy = useRef(false);
  const completed = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const draftKey = user && intent ? "servigaz_wizard_draft:" + user.id + (intent.clientId ? ":cliente:" + intent.clientId : intent.newClient ? ":nuevo" : "") : "";
  const selectedCustomer = customers.find(c => c.id === customerId);
  const services = selectedServices(catalog, categories, subtypes);
  const direct = services.length > 0 && services.every(s => !s.category.requiereVisita);

  useEffect(() => {
    if (!draftKey) return;
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    Promise.all(["/api/clientes", "/api/tecnicos", "/api/catalogo/servicios"].map(async url => {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar los datos del asistente.");
      if (!Array.isArray(body)) throw new Error("La respuesta del servidor no es válida. Vuelve a cargar el asistente.");
      return body;
    })).then(([clients, techs, cats]) => {
      if (controller.signal.aborted) return;
      clients = clients.map((client: Customer) => ({ ...client, telefonos: Array.isArray(client.telefonos) ? client.telefonos.map(String) : [String(client.telefonos || "")] }));
      const initialClient = intent?.clientId ? clients.find((client: Customer) => client.id === intent.clientId) : null;
      if (intent?.clientId && !initialClient) throw new Error("El cliente seleccionado no está disponible. Vuelve al cotizador y elige un cliente registrado.");
      setCustomers(clients); setTechnicians(techs); setCatalog(cats);
      if (initialClient) { setCustomerId(initialClient.id); setCustomer(customerDetails(initialClient)); setStep(2); }
      requestKey.current = crypto.randomUUID();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
      setDate(localDateInput(tomorrow));
      try {
        const saved = localStorage.getItem(draftKey);
        const draft = saved ? restoreWizardDraft(saved, clients, cats, techs) : null;
        if (draft && (!intent?.clientId || draft.customerId === intent.clientId)) {
          const restoredClient = clients.find((client: Customer) => client.id === draft.customerId);
          setCustomer(restoredClient ? customerDetails(restoredClient) : draft.customer); setCustomerId(draft.customerId); setCategories(draft.categories); setSubtypes(draft.subtypes);
          setIncludesGasProject(draft.includesGasProject); setDetails(draft.details); setPreference(draft.preference); setDuration(draft.duration); setMargin(draft.margin);
          setNotes(draft.notes); setSchedule(draft.schedule); setTechnicianId(draft.technicianId); setDate(draft.date);
          setStep(draft.step); requestKey.current = draft.requestKey; setRestored(true);
        }
      } catch { /* Storage can be blocked without preventing order creation. */ }
      if (!cats.some((c: Category) => c.subtipos.length)) throw new Error("No hay servicios con subtipos activos. Configura el catálogo para poder crear un trabajo.");
    }).catch(err => { if (!controller.signal.aborted) setLoadError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [draftKey, reload, intent]);

  useEffect(() => {
    if (loading || loadError || !draftKey || completed.current || !requestKey.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 2, step, customerId, customer, categories, subtypes, notes, includesGasProject, details, preference, duration, margin, schedule, technicianId, date, requestKey: requestKey.current })); } catch { /* Optional local draft. */ }
  }, [draftKey, loading, loadError, step, customerId, customer, categories, subtypes, notes, includesGasProject, details, preference, duration, margin, schedule, technicianId, date]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const clearSlot = useCallback(() => { setSchedule(false); setTechnicianId(""); setDate(""); }, []);

  function go(target: 1 | 2 | 3) {
    if (busy.current) return;
    setError("");
    if (target > 1) {
      const message = customerError(customer, selectedCustomer);
      if (message) { setStep(1); setError(message); return; }
    }
    if (target > 2 && (!services.length || services.length !== categories.length)) {
      setStep(2); setError("Selecciona al menos un servicio y un subtipo activo por categoría."); return;
    }
    if (target > 1 && preference.desde && preference.hasta && preference.desde >= preference.hasta) { setStep(1); setError("La hora final de preferencia debe ser posterior a la inicial."); return; }
    setStep(target);
  }
  function selectCustomer(client: Customer) {
    setCustomerId(client.id); setQuery(""); setError("");
    setCustomer(customerDetails(client));
  }
  function toggleCategory(category: Category) {
    setError("");
    setCategories(previous => previous.includes(category.codigo) ? previous.filter(code => code !== category.codigo) : [...previous, category.codigo]);
    setSubtypes(previous => ({ ...previous, [category.codigo]: previous[category.codigo] || category.subtipos[0]?.codigo || "" }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return;
    const message = customerError(customer, selectedCustomer);
    if (message) { setStep(1); setError(message); return; }
    if (!services.length || services.length !== categories.length) { setStep(2); setError("Selecciona servicios válidos antes de guardar."); return; }
    if (schedule && !technicians.some(t => t.id === technicianId)) { setError("Selecciona un técnico disponible para la visita."); return; }
    const scheduledDate = date ? new Date(date) : null;
    if (schedule && (!scheduledDate || !Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now())) { setError("Selecciona una fecha y hora futura para la visita."); return; }
    setError(""); busy.current = true; setSaving(true);
    try {
      const response = await fetch("/api/trabajos", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current }, body: JSON.stringify({
        clienteId: selectedCustomer?.id || null,
        nuevoCliente: selectedCustomer ? null : { ...customer, email: customer.email.trim() || null },
        tipoFlujo: direct ? "SIMPLIFICADO" : "COMPLETO", subtipoCodigos: services.map(s => s.subtype.codigo),
        subtipoCodigo: services.map(s => s.subtype.codigo).join("_"), subtipoNombre: services.map(s => s.subtype.nombre).join(" + "),
        incluyeProyectoGas: services.some(s => s.category.codigo === "GAS") && includesGasProject,
        observaciones: notes, detallesCliente: details, preferenciaCliente: (preference.fecha || preference.desde || preference.hasta) ? { ...preference, desde: preference.desde || "00:00", hasta: preference.hasta || "23:59" } : null,
        agenda: { duracionMinutos: duration, margenMinutos: margin, zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone }, tecnicoId: schedule ? technicianId : null, fechaProgramada: schedule ? scheduledDate!.toISOString() : null,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el trabajo.");
      if (!result.id) throw new Error("El servidor no devolvió el trabajo. Intenta nuevamente para recuperar el resultado.");
      completed.current = true;
      try { localStorage.removeItem(draftKey); } catch { /* Saving succeeded even if storage is blocked. */ }
      router.push("/trabajos/" + result.id);
    } catch (err: any) { setError(err.message || "No se pudo conectar. Puedes volver a intentar sin duplicar la solicitud."); busy.current = false; setSaving(false); }
  }
  const normalized = query.trim().toLowerCase();
  const matches = normalized.length >= 2 ? customers.filter(c => (c.nombreCompleto + " " + c.telefonos.join(" ") + " " + (c.direccion || "")).toLowerCase().includes(normalized)).slice(0, 8) : [];
  if (loading) return <p role="status" className="module-note">Cargando clientes, servicios y técnicos…</p>;
  if (loadError) return <div className="module-card space-y-4"><p role="alert" className="module-error">{loadError}</p><button className="primary-action" onClick={() => setReload(n => n + 1)}>Volver a cargar</button><Link className="theme-toggle" href="/trabajos">Volver a trabajos</Link></div>;

  return <div className="max-w-4xl mx-auto space-y-5 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="module-eyebrow">NUEVA SOLICITUD</p><h2 className="text-2xl font-semibold text-ink">Nuevo trabajo</h2><p className="text-sm text-muted mt-2">Selecciona el cliente, define el servicio y revisa antes de guardar.</p></div><Link className="theme-toggle" href="/trabajos"><ArrowLeft size={16} />Trabajos</Link></div>
    {restored && <p className="module-note">Recuperamos tu borrador. Revisa los datos antes de crear el trabajo.</p>}
    {selectedCustomer && <p className="module-note">Cliente seleccionado: <strong>{selectedCustomer.nombreCompleto}</strong> · {selectedCustomer.telefonos.join(", ")} · {selectedCustomer.direccion}</p>}
    <nav aria-label="Pasos del nuevo trabajo" className="grid grid-cols-3 gap-2">{[{ number: 1, name: "Cliente", icon: User }, { number: 2, name: "Servicio", icon: Wrench }, { number: 3, name: "Coordinar", icon: ClipboardCheck }].map(item => <button type="button" key={item.number} disabled={saving} aria-current={step === item.number ? "step" : undefined} onClick={() => go(item.number as 1 | 2 | 3)} className={"module-card flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 !p-3 text-left " + (step === item.number ? "ring-2 ring-[#F06529]" : "")}><span className="rounded-full bg-wash w-7 h-7 flex items-center justify-center shrink-0 text-ink text-sm">{step > item.number ? <Check size={16} /> : item.number}</span><span className="text-xs sm:text-sm font-semibold text-ink">{item.name}</span></button>)}</nav>
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="module-error">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); if (step === 3) submit(event); else go((step + 1) as 2 | 3); }} className="space-y-5">
      <fieldset disabled={saving} className="module-card space-y-5 min-w-0">
        {step === 1 && <>
          <div><h3 className="text-lg font-semibold text-ink">¿Para quién es el trabajo?</h3><p className="text-sm text-muted mt-1">Busca un cliente existente o registra uno nuevo.</p></div>
          <label className="form-label block">Buscar cliente por nombre, teléfono o dirección<div className="relative mt-2"><Search size={16} className="absolute left-3 top-3 text-faint" /><input className="module-input pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Escribe al menos 2 caracteres" autoComplete="off" /></div></label>
          {normalized.length >= 2 && <div className="space-y-2" aria-label="Clientes encontrados">{matches.length ? matches.map(client => <button type="button" className="w-full text-left rounded-xl border border-line p-3 hover:bg-wash" key={client.id} onClick={() => selectCustomer(client)}><strong className="block text-sm text-ink">{client.nombreCompleto}</strong><span className="text-xs text-muted">{client.telefonos.join(" · ")} · {client.direccion || "Sin dirección"}</span></button>) : <p className="text-sm text-muted">No encontramos coincidencias. Completa los datos para registrar un nuevo cliente.</p>}</div>}
          {selectedCustomer ? <div className="module-note space-y-2"><p className="font-semibold">Cliente existente: {selectedCustomer.nombreCompleto}</p><p>{customer.telefono || "Sin teléfono"} · {customer.direccion || "Sin dirección registrada"}</p><p className="text-xs">Se usará su ficha actual. Puedes actualizarla desde Clientes.</p><button type="button" className="theme-toggle" onClick={() => { setCustomerId(null); setCustomer({ ...emptyCustomer }); setQuery(""); }}>Registrar otro cliente</button></div> : <div className="grid sm:grid-cols-2 gap-4">
            <label className="form-label">Nombre completo<input className="module-input mt-2" value={customer.nombreCompleto} maxLength={300} onChange={e => setCustomer({ ...customer, nombreCompleto: e.target.value })} autoComplete="name" /></label>
            <label className="form-label">Teléfono / WhatsApp<input type="tel" className="module-input mt-2" value={customer.telefono} maxLength={30} onChange={e => setCustomer({ ...customer, telefono: e.target.value })} autoComplete="tel" /></label>
            <label className="form-label sm:col-span-2">Dirección<input className="module-input mt-2" value={customer.direccion} maxLength={1000} onChange={e => setCustomer({ ...customer, direccion: e.target.value })} autoComplete="street-address" /></label>
            <label className="form-label sm:col-span-2">Correo electrónico (opcional)<input type="email" className="module-input mt-2" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" /></label>
          </div>}
          <label className="form-label block">Detalles del cliente e indicaciones para llegar<textarea rows={3} className="module-input mt-2" value={details} maxLength={2000} onChange={e => setDetails(e.target.value)} placeholder="Referencias, acceso más rápido, persona de contacto, restricciones de horario…" /></label>
          <div><h4 className="font-semibold text-sm text-ink">Horario de preferencia del cliente (opcional)</h4><div className="grid sm:grid-cols-3 gap-3 mt-3"><label className="form-label">Día preferido<input type="date" className="module-input mt-2" min={localDateInput(new Date()).slice(0, 10)} value={preference.fecha} onChange={e => setPreference({ ...preference, fecha: e.target.value })} /></label><label className="form-label">Desde<input type="time" className="module-input mt-2" value={preference.desde} onChange={e => setPreference({ ...preference, desde: e.target.value })} /></label><label className="form-label">Hasta<input type="time" className="module-input mt-2" value={preference.hasta} onChange={e => setPreference({ ...preference, hasta: e.target.value })} /></label></div><p className="text-xs text-muted mt-2">Esta es su preferencia; el horario se confirma después de consultar las agendas.</p></div>
        </>}
        {step === 2 && <>
          <div><h3 className="text-lg font-semibold text-ink">¿Qué necesita el cliente?</h3><p className="text-sm text-muted mt-1">Puedes elegir varias categorías. Selecciona un subtipo en cada una.</p></div>
          <div className="grid sm:grid-cols-2 gap-3">{catalog.map(category => { const checked = categories.includes(category.codigo); return <div className={"rounded-xl border p-4 space-y-3 " + (checked ? "border-[#F06529] bg-[#F06529]/5" : "border-line")} key={category.id}>
            <label className="flex items-start gap-3 cursor-pointer text-sm font-semibold text-ink"><input type="checkbox" className="mt-1 accent-[#F06529]" disabled={!category.subtipos.length} checked={checked} onChange={() => toggleCategory(category)} />{category.nombre}</label>
            {category.descripcion && <p className="text-xs text-muted">{category.descripcion}</p>}
            {category.subtipos.length ? <label className="form-label block">Servicio de {category.nombre}<select className="module-input mt-2" disabled={!checked} value={subtypes[category.codigo] || category.subtipos[0]?.codigo} onChange={e => setSubtypes({ ...subtypes, [category.codigo]: e.target.value })}>{category.subtipos.map(subtype => <option value={subtype.codigo} key={subtype.id}>{subtype.nombre}</option>)}</select></label> : <p className="text-xs text-muted">Sin subtipos activos. Configura esta categoría antes de usarla.</p>}
          </div>; })}</div>
          {services.some(s => s.category.codigo === "GAS") && <label className="flex gap-3 items-start text-sm text-ink"><input type="checkbox" className="mt-1 accent-[#F06529]" checked={includesGasProject} onChange={e => setIncludesGasProject(e.target.checked)} /><span>La instalación incluye proyecto de gas<small className="block text-muted mt-1">Permite seguimiento diario ante la entidad y exige entrega para el cierre final. Déjalo desmarcado si el alcance de esta instalación menor no incluye proyecto.</small></span></label>}
          {services.length > 0 && <p className="module-note">{direct ? "Servicio directo: podrás preparar la cotización desde la ficha del trabajo. No requiere visita de medición." : "Incluye un servicio que requiere evaluación. Puedes agendar la visita en el siguiente paso o dejarla pendiente."}</p>}
          <label className="form-label block">Observaciones (opcional)<textarea rows={3} className="module-input mt-2" maxLength={3000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
        </>}
        {step === 3 && <>
          <div><h3 className="text-lg font-semibold text-ink">Coordina con el técnico y confirma</h3><p className="text-sm text-muted mt-1">{direct ? "El trabajo quedará listo para preparar su cotización." : "El trabajo requiere una visita de evaluación antes de cotizar."}</p></div>
          <dl className="grid sm:grid-cols-2 gap-4 rounded-xl bg-wash p-4 text-sm"><div><dt className="text-muted text-xs">Cliente</dt><dd className="text-ink font-semibold mt-1">{customer.nombreCompleto}</dd><dd className="text-secondary mt-1">{customer.telefono || "Sin teléfono"}</dd></div><div><dt className="text-muted text-xs">Dirección</dt><dd className="text-secondary mt-1">{customer.direccion || "Sin dirección registrada"}</dd></div><div className="sm:col-span-2"><dt className="text-muted text-xs">Servicios</dt><dd className="text-ink mt-1">{services.map(s => s.subtype.nombre).join(" + ")}</dd></div>{notes && <div className="sm:col-span-2"><dt className="text-muted text-xs">Observaciones</dt><dd className="text-secondary mt-1 whitespace-pre-wrap">{notes}</dd></div>}</dl>
          {details && <p className="module-note whitespace-pre-wrap"><strong>Indicaciones del cliente:</strong> {details}</p>}
          <div className="grid sm:grid-cols-2 gap-3"><label className="form-label">Duración estimada de la visita<select className="module-input mt-2" value={duration} onChange={e => setDuration(Number(e.target.value))}>{[30, 60, 90, 120, 180, 240, 480].map(n => <option value={n} key={n}>{n} minutos</option>)}</select></label><label className="form-label">Tiempo para traslado<select className="module-input mt-2" value={margin} onChange={e => setMargin(Number(e.target.value))}>{[0, 15, 30, 45, 60, 90, 120].map(n => <option value={n} key={n}>{n} minutos</option>)}</select></label></div>
          <TechnicianAgenda preference={preference} duration={duration} margin={margin} technicianId={technicianId} selectedDate={date} onClear={clearSlot} onSelect={(id, value) => { setTechnicianId(id); setDate(value); setSchedule(true); setError(""); }} />
          {schedule ? <div role="status" className="module-success"><p>Horario elegido: {technicians.find(t => t.id === technicianId)?.nombre} · {new Date(date).toLocaleString("es")}.</p><p className="text-xs mt-1">Confirma con el cliente antes de crear el trabajo.</p><button type="button" className="theme-toggle mt-2" onClick={clearSlot}>Dejar pendiente de coordinación</button></div> : <p className="module-note">Selecciona un espacio disponible para coordinar la visita. También puedes guardar el trabajo pendiente, sin comprometer un horario.</p>}

        </>}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">{step > 1 ? <button disabled={saving} type="button" className="theme-toggle" onClick={() => go((step - 1) as 1 | 2)}><ArrowLeft size={16} />Volver</button> : <span className="text-xs text-muted">Paso 1 de 3</span>}<button disabled={saving} type="submit" className="primary-action">{saving ? "Guardando trabajo…" : step === 3 ? "Crear trabajo" : "Continuar"}{step < 3 && <ArrowRight size={16} />}</button></div>
    </form>
  </div>;
}
