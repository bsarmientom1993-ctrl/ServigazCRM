"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Calculator, Search, UserPlus, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
type Customer = { id: string; nombreCompleto: string; telefonos: string[]; direccion: string | null; email: string | null };
const money = (value: unknown) => Number(value || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function CotizadorPage() {
  const { user, loading: authLoading } = useAuth();
  const manager = user?.rol === "ADMIN" || user?.rol === "ENCARGADO";
  const [customers, setCustomers] = useState<Customer[]>([]), [selectedId, setSelectedId] = useState(""), [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null), [works, setWorks] = useState<any[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [historyLoading, setHistoryLoading] = useState(false), [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(""), [historyError, setHistoryError] = useState(""), [reload, setReload] = useState(0);
  const initialSelection = useRef(false); const selectedRef = useRef(""); const moreBusy = useRef(false);
  useEffect(() => {
    if (!manager) return;
    const controller = new AbortController(); setLoading(true); setError("");
    fetch("/api/clientes", { signal: controller.signal }).then(async res => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "No se pudo cargar el directorio.");
      setCustomers(data);
      const requested = initialSelection.current ? null : new URLSearchParams(window.location.search).get("clienteId");
      initialSelection.current = true;
      if (requested) {
        if (!data.some((item: Customer) => item.id === requested)) throw new Error("El cliente solicitado no está disponible. Selecciona uno de tu directorio.");
        setSelectedId(requested);
      }
    }).catch(err => { if (err.name !== "AbortError") setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [manager, user?.id, reload]);
  useEffect(() => {
    selectedRef.current = selectedId; setCustomer(null); setWorks([]); setCursor(null); setHistoryError("");
    if (!selectedId) { setHistoryLoading(false); return; }
    const controller = new AbortController(); setHistoryLoading(true);
    fetch("/api/clientes/" + encodeURIComponent(selectedId) + "/historial", { signal: controller.signal }).then(async res => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "No se pudo cargar el historial.");
      setCustomer(data.cliente); setWorks(data.trabajos); setCursor(data.siguiente);
    }).catch(err => { if (err.name !== "AbortError") setHistoryError(err.message); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [selectedId, reload]);
  async function loadMore() {
    if (!cursor || moreBusy.current) return; moreBusy.current = true; setMoreLoading(true); setHistoryError(""); const id = selectedId;
    try {
      const res = await fetch("/api/clientes/" + encodeURIComponent(id) + "/historial?cursor=" + encodeURIComponent(cursor)); const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el historial.");
      if (selectedRef.current === id) { setWorks(previous => [...previous, ...data.trabajos]); setCursor(data.siguiente); }
    } catch (err: any) { if (selectedRef.current === id) setHistoryError(err.message); } finally { moreBusy.current = false; setMoreLoading(false); }
  }
  if (authLoading) return <p className="module-note">Cargando tu sesión…</p>;
  if (!manager) return <p role="alert" className="module-error">Solo los encargados y administradores pueden cotizar.</p>;
  const filtered = customers.filter(item => [item.nombreCompleto, item.direccion || "", ...(item.telefonos || [])].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="max-w-6xl mx-auto space-y-6">
    <section className="module-card space-y-4"><p className="module-eyebrow">CADA COTIZACIÓN TIENE UN CLIENTE</p><h2 className="text-2xl font-semibold text-ink flex items-center gap-3"><Calculator />Cotizaciones e historial del cliente</h2><p className="text-sm text-secondary">Selecciona un cliente registrado o registra uno nuevo antes de cotizar. Cada servicio o compra tendrá su propia solicitud, cotización y seguimiento.</p></section>
    {!customer && <section className="module-card space-y-4"><h3 className="font-semibold text-ink">Primero, identifica al cliente</h3><Link className="primary-action inline-flex" href="/trabajos/nuevo?nuevoCliente=1"><UserPlus size={18} />Registrar cliente y solicitud</Link><p className="text-sm text-muted">Si ya existe, búscalo en el directorio para mantener su historial.</p></section>}
    <section className="module-card space-y-4"><h3 className="font-semibold text-ink flex gap-2 items-center"><UserRound size={18} />{customer ? "Cambiar de cliente" : "Cliente existente"}</h3>
      {error && <div role="alert" className="module-error">{error}<button className="theme-toggle ml-3" onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
      <label className="form-label block">Buscar por nombre, teléfono o dirección<div className="relative mt-2"><Search size={17} className="absolute left-3 top-3 text-muted" /><input className="module-input pl-10" value={query} onChange={e => setQuery(e.target.value)} placeholder="Escribe el nombre o teléfono del cliente" /></div></label>
      {loading ? <p role="status" className="module-note">Cargando clientes…</p> : <label className="form-label block">Selecciona el cliente<select className="module-input mt-2" value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Seleccionar cliente registrado</option>{(selectedId && !filtered.some(item => item.id === selectedId) ? [...customers.filter(item => item.id === selectedId), ...filtered] : filtered).map(item => <option key={item.id} value={item.id}>{item.nombreCompleto} · {(item.telefonos || []).join(", ")}</option>)}</select></label>}
      {!loading && !filtered.length && <p className="module-note">No hay clientes que coincidan. Puedes registrar uno nuevo.</p>}
    </section>
    {historyLoading && <p role="status" className="module-note">Consultando el registro del cliente…</p>}
    {historyError && <div role="alert" className="module-error">{historyError}<button className="theme-toggle ml-3" onClick={() => setReload(value => value + 1)}>Actualizar historial</button></div>}
    {customer && <><section className="module-card space-y-4"><h3 className="text-xl font-semibold text-ink">{customer.nombreCompleto}</h3><p className="text-sm text-secondary">{(customer.telefonos || []).join(", ")} · {customer.direccion || "Sin dirección"}</p><Link className="primary-action inline-flex" href={"/trabajos/nuevo?clienteId=" + encodeURIComponent(customer.id)}>Nueva cotización de servicio o compra</Link><p className="module-note">Primero registra el servicio o equipo solicitado. La cotización se emite desde esa orden y se guarda en este historial. Las instalaciones que requieren evaluación mantienen ese paso previo.</p></section>
      <section className="space-y-4"><h3 className="text-xl font-semibold text-ink">Servicios, compras y cotizaciones registradas</h3>{!works.length ? <p className="module-note">Este cliente todavía no tiene solicitudes registradas.</p> : works.map(work => {
        const quote = work.cotizaciones[0]; const paid = work.pagos.reduce((sum: number, payment: any) => sum + Number(payment.monto), 0);
        return <article key={work.id} className="module-card space-y-3"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-ink">{work.subtipoNombre}</h4><span className="text-xs text-muted">{work.codigoCorrelativo} · {new Date(work.createdAt).toLocaleDateString("es")}</span></div><p className="text-sm text-secondary">Estado de la solicitud: {work.estado.replaceAll("_", " ")}{work.egreso ? " · Cierre realizado" : ""}</p>{quote ? <p className="text-sm text-secondary">Cotización v{quote.numeroVersion}: <strong>Bs. {money(quote.totalCotizado)}</strong> · {quote.estado} · Pagado: Bs. {money(paid)}</p> : <p className="text-sm text-muted">Sin cotización emitida. Abre la solicitud para completar el paso pendiente.</p>}<div className="flex flex-wrap gap-3"><Link className="theme-toggle" href={"/trabajos/" + work.id + "#cotizacion"}>{quote ? "Ver solicitud y seguimiento" : "Abrir solicitud para cotizar"}</Link><Link className="theme-toggle" href={"/fotos/" + work.id}>Carpetas de fotos</Link>{quote && <Link className="theme-toggle" href={"/trabajos/" + work.id + "/cotizacion/" + quote.id + "/carta"}>Ver carta de cotización</Link>}</div></article>;
      })}{cursor && <button className="theme-toggle" disabled={moreLoading} onClick={loadMore}>{moreLoading ? "Cargando…" : "Ver más registros"}</button>}</section></>}
  </div>;
}
