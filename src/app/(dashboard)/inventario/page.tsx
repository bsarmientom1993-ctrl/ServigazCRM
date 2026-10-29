"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Package, Plus, ArrowRightLeft, Warehouse, Store, Settings2, Search, Truck, Check, X, AlertTriangle, History } from "lucide-react";

type Location = { id: string; nombre: string; tipo: string; sucursalId: string | null; esInicial: boolean; sucursal?: { nombre: string } | null };
type Product = { id: string; nombre: string; codigoSku: string; categoria: string; unidadMedida: string; stockActual: number; stockGlobal?: string;
  stockMinimo: number; bajoMinimo: boolean; costoPromedio: string; precioVenta: string; existencias: { stockActual: string; stockMinimo: string; ubicacion: Location }[] };
type Transfer = { id: string; producto: Product; origen: Location; destino: Location; cantidad: string; estado: string; createdAt: string; enviadoPor: { nombre: string } };
const emptyProduct = { codigoSku: "", nombre: "", categoria: "", unidadMedida: "unidad", precioVenta: "" };

export default function InventarioPage() {
  const { user } = useAuth();
  const store = user?.rol === "ENCARGADO_TIENDA";const warehouse=user?.rol==="ALMACENERO";
  const admin = user?.rol === "ADMIN";
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [directory, setDirectory] = useState<Location[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newProduct, setNewProduct] = useState(false);
  const [productData, setProductData] = useState(emptyProduct);
  const [transferData, setTransferData] = useState({ productoId: "", origenId: "", destinoId: "", cantidad: "", observaciones: "" });
  const [minimum, setMinimum] = useState({ productoId: "", stockMinimo: "" });
  const [cancelId, setCancelId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const transferKey = useRef("");
  const busy = useRef(false);
  const loadSequence = useRef(0);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("ubicacionId"); if (id) setLocationId(id); }, []);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const urls = ["/api/inventario" + (locationId ? "?ubicacionId=" + encodeURIComponent(locationId) : ""), "/api/ubicaciones",
        "/api/ubicaciones?directorio=1", "/api/inventario/traspasos", "/api/inventario/movimientos" + (locationId ? "?ubicacionId=" + encodeURIComponent(locationId) : "")];
      const results = await Promise.all(urls.map(async url => {
        const response = await fetch(url); const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el inventario.");
        return data;
      }));
      if (sequence !== loadSequence.current) return;
      setProducts(Array.isArray(results[0]) ? results[0] : results[0].productos || []);
      setLocations(results[1].ubicaciones); setDirectory(results[2].ubicaciones); setTransfers(results[3].traspasos); setMovements(results[4].movimientos);
    } catch (err: any) { if (sequence === loadSequence.current) setError(err.message); } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [locationId]);
  useEffect(() => { load(); }, [load]);
  async function mutate(url: string, method: string, body: unknown, key?: string) {
    if (busy.current) return false;
    busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      await load(); return true;
    } catch (err: any) { setError(err.message); return false; } finally { busy.current = false; setSaving(false); }
  }
  const filtered = products.filter(p => (p.nombre + " " + p.codigoSku + " " + p.categoria).toLowerCase().includes(search.toLowerCase()));
  const selected = locations.find(l => l.id === locationId);
  const pending = transfers.filter(t => t.estado === "EN_TRANSITO");
  const low = products.filter(p => p.bajoMinimo).length;
  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><p className="module-eyebrow">ABASTECIMIENTO Y DISTRIBUCIÓN</p><h2 className="text-2xl font-semibold text-ink">Almacenes y tiendas</h2><p className="text-sm text-muted mt-2">Existencias por ubicación y traspasos con recepción confirmada.</p></div>
      <div className="flex flex-wrap gap-2">{!store && !warehouse && <Link className="theme-toggle" href="/sucursales"><Settings2 size={16} />Ubicaciones</Link>}<Link className="primary-action" href="/inventario/compras"><Plus size={16} />Registrar compra</Link></div>
    </div>
    {error && <p role="alert" className="module-error">{error}</p>}
    {message && <p role="status" className="module-success">{message}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[{ title: "Almacenes", value: locations.filter(l => l.tipo === "ALMACEN" && !l.esInicial).length, icon: Warehouse },
        { title: "Tiendas", value: locations.filter(l => l.tipo === "TIENDA").length, icon: Store },
        { title: "Traspasos en tránsito", value: pending.length, icon: Truck }, { title: "Stock bajo en esta vista", value: low, icon: AlertTriangle }].map(item =>
        <div className="module-card flex items-center justify-between gap-2" key={item.title}><div><p className="text-xs text-muted">{item.title}</p><p className="text-2xl font-semibold text-ink mt-2">{item.value}</p></div><item.icon size={22} className="text-[#F06529]" strokeWidth={1.5} /></div>)}
    </div>
    {locations.some(l => l.esInicial) && <div className="module-note">El stock anterior está en <strong>Inventario previo · por distribuir</strong>. Distribúyelo mediante traspasos a las ubicaciones reales antes de utilizarlo en trabajos.</div>}
    <div className="module-card flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <div className="flex flex-wrap gap-2">{[{ id: "stock", name: "Existencias", icon: Package }, { id: "transfers", name: "Traspasos", icon: ArrowRightLeft }, { id: "history", name: "Movimientos", icon: History }].map(item =>
        <button type="button" aria-pressed={tab === item.id} key={item.id} className={tab === item.id ? "primary-action" : "theme-toggle"} onClick={() => setTab(item.id)}><item.icon size={15} />{item.name}</button>)}</div>
      <label className="text-xs text-muted">Ubicación<select className="module-input mt-1" value={locationId} onChange={e => { setLocationId(e.target.value); setMinimum({ productoId: "", stockMinimo: "" }); }}>
        <option value="">Todas mis ubicaciones</option>{locations.map(l => <option key={l.id} value={l.id}>{l.nombre}{l.sucursal ? " · " + l.sucursal.nombre : ""}</option>)}</select></label>
    </div>
    {tab === "stock" && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="relative flex-1 max-w-md"><Search size={16} className="absolute left-3 top-3 text-faint" /><input aria-label="Buscar productos" className="module-input pl-9" placeholder="Buscar producto, SKU o categoría" value={search} onChange={e => setSearch(e.target.value)} /></label><button type="button" className="theme-toggle" onClick={() => setNewProduct(!newProduct)}><Plus size={16} />Nuevo producto</button></div>
      {newProduct && <form className="module-card space-y-4" onSubmit={async e => { e.preventDefault(); if (await mutate("/api/inventario", "POST", { ...productData, precioVenta: Number(productData.precioVenta) })) { setNewProduct(false); setProductData(emptyProduct); setMessage("Producto creado. Registra una compra para ingresar existencias."); } }}>
        <h3 className="font-semibold text-ink">Nuevo producto del catálogo</h3><fieldset disabled={saving} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[{ name: "codigoSku", label: "SKU" }, { name: "nombre", label: "Nombre" }, { name: "categoria", label: "Categoría" }, { name: "unidadMedida", label: "Unidad" }, { name: "precioVenta", label: "Precio de venta (Bs.)" }].map(f =>
            <label key={f.name} className="form-label">{f.label}<input required type={f.name === "precioVenta" ? "number" : "text"} min="0" step="0.01" className="module-input mt-2" value={productData[f.name as keyof typeof productData]} onChange={e => setProductData({ ...productData, [f.name]: e.target.value })} /></label>)}
          <button className="primary-action sm:col-span-2 lg:col-span-5 justify-self-end">Crear producto</button></fieldset></form>}
      <div className="module-table"><table><thead><tr><th>Producto</th><th>Ubicación</th><th>Disponible</th><th>Mínimo</th><th>Costo promedio</th><th>Precio de venta</th></tr></thead><tbody>
        {filtered.map(p => <tr key={p.id}><td><strong>{p.nombre}</strong><small>{p.codigoSku} · {p.categoria}</small></td><td>{selected?.nombre || <div className="space-y-1">{p.existencias.filter(s => Number(s.stockActual) > 0).map(s => <small key={s.ubicacion.id}>{s.ubicacion.nombre}: {Number(s.stockActual)}</small>)}</div>}</td>
          <td><strong className={p.bajoMinimo ? "text-red-600 dark:text-red-300" : "text-ink"}>{p.stockActual} {p.unidadMedida}</strong>{admin && !locationId && <small>Total con tránsito: {Number(p.stockGlobal || 0)}</small>}</td>
          <td>{selected && !selected.esInicial ? <button type="button" className="text-[#F06529] underline" onClick={() => setMinimum({ productoId: p.id, stockMinimo: String(p.stockMinimo) })}>{p.stockMinimo} · Editar</button> : <span>{locationId ? p.stockMinimo : "Por ubicación"}</span>}</td><td>Bs. {Number(p.costoPromedio).toLocaleString("es-BO")}</td><td>Bs. {Number(p.precioVenta).toLocaleString("es-BO")}</td></tr>)}
        {!filtered.length && <tr><td colSpan={6} className="text-center text-muted">{loading ? "Cargando..." : "No hay productos para esta búsqueda."}</td></tr>}
      </tbody></table></div>
      {minimum.productoId && locationId && <form className="module-card flex flex-wrap items-end gap-3" onSubmit={async e => { e.preventDefault(); if (await mutate("/api/inventario/minimos", "PATCH", { ...minimum, ubicacionId: locationId, stockMinimo: Number(minimum.stockMinimo) })) { setMinimum({ productoId: "", stockMinimo: "" }); setMessage("Mínimo de la ubicación actualizado."); } }}>
        <label className="form-label">Mínimo para {products.find(p => p.id === minimum.productoId)?.nombre}<input required min="0" step="0.01" type="number" className="module-input mt-2" value={minimum.stockMinimo} onChange={e => setMinimum({ ...minimum, stockMinimo: e.target.value })} /></label><button disabled={saving} className="primary-action">Guardar mínimo</button><button type="button" className="theme-toggle" onClick={() => setMinimum({ productoId: "", stockMinimo: "" })}>Volver</button></form>}
    </>}
    {tab === "transfers" && <>
      <form className="module-card space-y-4" onSubmit={async e => {
        e.preventDefault(); if (!transferKey.current) transferKey.current = crypto.randomUUID();
        if (await mutate("/api/inventario/traspasos", "POST", { ...transferData, cantidad: Number(transferData.cantidad) }, transferKey.current)) {
          transferKey.current = ""; setTransferData({ productoId: "", origenId: "", destinoId: "", cantidad: "", observaciones: "" }); setMessage("Envío registrado. El destino deberá confirmar la recepción."); }
      }}><h3 className="font-semibold text-ink">Enviar material a otra ubicación</h3><p className="text-sm text-muted">Sale del disponible del origen y permanece en tránsito hasta que el destino lo reciba.</p>
        <fieldset disabled={saving} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="form-label">Producto<select required className="module-input mt-2" value={transferData.productoId} onChange={e => setTransferData({ ...transferData, productoId: e.target.value })}><option value="">Seleccionar</option>{products.map(p => <option key={p.id} value={p.id}>{p.codigoSku} · {p.nombre}</option>)}</select></label>
          <label className="form-label">Origen<select required className="module-input mt-2" value={transferData.origenId} onChange={e => setTransferData({ ...transferData, origenId: e.target.value })}><option value="">Seleccionar</option>{locations.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label>
          <label className="form-label">Destino<select required className="module-input mt-2" value={transferData.destinoId} onChange={e => setTransferData({ ...transferData, destinoId: e.target.value })}><option value="">Seleccionar</option>{directory.filter(l => l.id !== transferData.origenId).map(l => <option key={l.id} value={l.id}>{l.nombre}{l.sucursal ? " · " + l.sucursal.nombre : ""}</option>)}</select></label>
          <label className="form-label">Cantidad<input required min="0.01" step="0.01" type="number" className="module-input mt-2" value={transferData.cantidad} onChange={e => setTransferData({ ...transferData, cantidad: e.target.value })} /></label>
          <label className="form-label sm:col-span-2 lg:col-span-3">Referencia u observaciones<input className="module-input mt-2" maxLength={1000} value={transferData.observaciones} onChange={e => setTransferData({ ...transferData, observaciones: e.target.value })} /></label><button className="primary-action self-end"><ArrowRightLeft size={16} />Registrar envío</button>
        </fieldset>
      </form>
      <div className="module-table"><table><thead><tr><th>Producto / fecha</th><th>Recorrido</th><th>Cantidad</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{transfers.filter(t => !locationId || t.origen.id === locationId || t.destino.id === locationId).map(t =>
        <tr key={t.id}><td><strong>{t.producto.nombre}</strong><small>{new Date(t.createdAt).toLocaleString("es-BO")}</small></td><td>{t.origen.nombre}<small>→ {t.destino.nombre}</small></td><td>{Number(t.cantidad)} {t.producto.unidadMedida}</td><td><span className="text-xs font-semibold">{t.estado === "EN_TRANSITO" ? "En tránsito" : t.estado === "RECIBIDO" ? "Recibido" : "Devuelto al origen"}</span></td><td><div className="flex flex-wrap gap-2">
          {t.estado === "EN_TRANSITO" && (admin || warehouse&&locations.some(l=>l.id===t.destino.id) || store && t.destino.tipo === "TIENDA" || t.destino.sucursalId === user?.sucursalId) && <button disabled={saving} className="theme-toggle" onClick={async () => { if (await mutate("/api/inventario/traspasos", "PATCH", { id: t.id, accion: "RECIBIR" })) setMessage("Recepción confirmada y stock del destino actualizado."); }}><Check size={15} />Recibir</button>}
          {t.estado === "EN_TRANSITO" && (admin || warehouse&&locations.some(l=>l.id===t.origen.id) || store && t.origen.tipo === "TIENDA" || t.origen.sucursalId === user?.sucursalId) && <button disabled={saving} className="theme-toggle" onClick={() => { setCancelId(t.id); setCancelReason(""); }}><X size={15} />Devolver</button>}
        </div></td></tr>)}
        {!transfers.length && <tr><td colSpan={5} className="text-center text-muted">Aún no hay traspasos.</td></tr>}</tbody></table></div><p className="text-xs text-muted">Se muestran los últimos 200 traspasos de tu ámbito.</p>
      {cancelId && <form className="module-card space-y-3" onSubmit={async e => { e.preventDefault(); if (await mutate("/api/inventario/traspasos", "PATCH", { id: cancelId, accion: "CANCELAR", motivo: cancelReason })) { setCancelId(""); setMessage("Traspaso anulado y material devuelto al origen."); } }}>
        <h3 className="font-semibold text-ink">Anular y devolver al origen</h3><label className="form-label">Motivo<input required minLength={5} maxLength={1000} className="module-input mt-2" value={cancelReason} onChange={e => setCancelReason(e.target.value)} /></label><label className="flex gap-2 text-sm text-secondary"><input type="checkbox" required />Confirmo que el material sigue o ha regresado al origen.</label><div className="flex gap-2"><button disabled={saving} className="primary-action">Confirmar devolución</button><button type="button" className="theme-toggle" onClick={() => setCancelId("")}>Volver</button></div></form>}
    </>}
    {tab === "history" && <div className="module-table"><table><thead><tr><th>Fecha / responsable</th><th>Producto</th><th>Movimiento</th><th>Ubicaciones</th><th>Cantidad</th><th>Saldo de ubicación</th></tr></thead><tbody>{movements.map(m =>
      <tr key={m.id}><td>{new Date(m.fecha).toLocaleString("es-BO")}<small>{m.usuario.nombre}</small></td><td>{m.producto.nombre}</td><td>{m.evento || m.tipoMovimiento}</td><td>{m.ubicacionOrigen?.nombre || "—"}<small>→ {m.ubicacionDestino?.nombre || "—"}</small></td><td>{Number(m.cantidad)}</td><td>{m.stockAnterior === null ? "—" : Number(m.stockAnterior)} → {m.stockNuevo === null ? "—" : Number(m.stockNuevo)}</td></tr>)}{!movements.length && <tr><td colSpan={6} className="text-center text-muted">No hay movimientos para esta vista.</td></tr>}</tbody></table><p className="p-4 text-xs text-muted">Últimos 200 movimientos. Los movimientos históricos sin ubicación conservan su registro original.</p></div>}
  </div>;
}
