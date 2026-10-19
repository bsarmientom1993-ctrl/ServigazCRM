"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Building2, Warehouse, Store, Plus, MapPin, ArrowLeft, Pencil, Users } from "lucide-react";

type Branch = { id: string; nombre: string; direccion: string | null; telefono: string | null; activo: boolean; ubicaciones: Location[]; usuarios: { id: string; nombre: string; rol: string }[] };
type Location = { id: string; nombre: string; tipo: string; direccion: string | null; sucursalId: string | null; esInicial: boolean; activo: boolean; sucursal?: { nombre: string } };
export default function SucursalesPage() {
  const { user } = useAuth();
  const admin = user?.rol === "ADMIN";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<{ id: string; nombre: string; sucursalId: string | null; rol: string }[]>([]);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const [branchForm, setBranchForm] = useState({ nombre: "", direccion: "", telefono: "" });
  const [locationForm, setLocationForm] = useState({ nombre: "", tipo: "ALMACEN", sucursalId: "", direccion: "" });
  const [assign, setAssign] = useState({ usuarioId: "", sucursalId: "" });
  const [edit, setEdit] = useState<{ kind: "sucursales" | "ubicaciones"; id: string; nombre: string; direccion: string; telefono: string; activo: boolean } | null>(null);
  const load = useCallback(async () => {
    try {
      const results = await Promise.all(["/api/sucursales", admin ? "/api/ubicaciones?incluirInactivas=1" : "/api/ubicaciones"].map(async url => {
        const response = await fetch(url); const body = await response.json();
        if (!response.ok) throw new Error(body.error || "No se pudo cargar."); return body;
      }));
      setBranches(results[0].sucursales); setUsers(results[0].usuarios); setLocations(results[1].ubicaciones);
    } catch (err: any) { setError(err.message); }
  }, [admin]);
  useEffect(() => { load(); }, [load]);
  async function save(url: string, method: string, body: unknown, text: string) {
    if (saving) return false;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setMessage(text); await load(); return true;
    } catch (err: any) { setError(err.message); return false; } finally { setSaving(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="module-eyebrow">RED DE ABASTECIMIENTO</p><h2 className="text-2xl font-semibold text-ink">Sucursales y ubicaciones</h2><p className="text-sm text-muted mt-2">Los almacenes guardan los materiales y abastecen a las sucursales, que funcionan como tiendas.</p></div><Link href="/inventario" className="theme-toggle"><ArrowLeft size={16} />Ver inventario</Link></div>
    {error && <p role="alert" className="module-error">{error}</p>}{message && <p role="status" className="module-success">{message}</p>}
    {admin && <div className="grid xl:grid-cols-2 gap-5">
      <form className="module-card space-y-4" onSubmit={async e => { e.preventDefault(); if (await save("/api/sucursales", "POST", branchForm, "Sucursal y tienda creadas. Ya pueden recibir materiales del almacén.")) setBranchForm({ nombre: "", direccion: "", telefono: "" }); }}>
        <h3 className="font-semibold text-ink flex gap-2 items-center"><Building2 size={18} className="text-[#F06529]" />Nueva sucursal / tienda</h3><p className="text-sm text-muted">Se crea con su propia tienda para recibir materiales y controlar sus existencias.</p><fieldset disabled={saving} className="grid sm:grid-cols-2 gap-3">
          <label className="form-label sm:col-span-2">Nombre<input required minLength={2} maxLength={150} className="module-input mt-2" value={branchForm.nombre} onChange={e => setBranchForm({ ...branchForm, nombre: e.target.value })} placeholder="Nombre de la sucursal" /></label>
          <label className="form-label">Dirección<input maxLength={500} className="module-input mt-2" value={branchForm.direccion} onChange={e => setBranchForm({ ...branchForm, direccion: e.target.value })} /></label>
          <label className="form-label">Teléfono<input maxLength={40} type="tel" className="module-input mt-2" value={branchForm.telefono} onChange={e => setBranchForm({ ...branchForm, telefono: e.target.value })} /></label><button className="primary-action justify-self-end sm:col-span-2"><Plus size={16} />Crear sucursal</button>
        </fieldset>
      </form>
      <form className="module-card space-y-4" onSubmit={async e => { e.preventDefault(); if (await save("/api/ubicaciones", "POST", { ...locationForm, sucursalId: locationForm.sucursalId || null }, "Ubicación creada. Ya puedes recibir compras o traspasos.")) setLocationForm({ nombre: "", tipo: "ALMACEN", sucursalId: "", direccion: "" }); }}>
        <h3 className="font-semibold text-ink flex gap-2 items-center"><Warehouse size={18} className="text-[#F06529]" />Nueva ubicación adicional</h3><p className="text-sm text-muted">Añade más almacenes para guardar materiales, o tiendas adicionales en una sucursal existente.</p><fieldset disabled={saving} className="grid sm:grid-cols-2 gap-3">
          <label className="form-label sm:col-span-2">Nombre<input required minLength={2} maxLength={150} className="module-input mt-2" value={locationForm.nombre} onChange={e => setLocationForm({ ...locationForm, nombre: e.target.value })} placeholder="Almacén central, almacén secundario, tienda..." /></label>
          <label className="form-label">Tipo<select className="module-input mt-2" value={locationForm.tipo} onChange={e => setLocationForm({ ...locationForm, tipo: e.target.value })}><option value="ALMACEN">Almacén</option><option value="TIENDA">Tienda</option></select></label>
          <label className="form-label">Sucursal<select required={locationForm.tipo === "TIENDA"} className="module-input mt-2" value={locationForm.sucursalId} onChange={e => setLocationForm({ ...locationForm, sucursalId: e.target.value })}><option value="">{locationForm.tipo === "ALMACEN" ? "Central · compartido" : "Seleccionar sucursal"}</option>{branches.filter(b => b.activo).map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select></label>
          <label className="form-label sm:col-span-2">Dirección<input maxLength={500} className="module-input mt-2" value={locationForm.direccion} onChange={e => setLocationForm({ ...locationForm, direccion: e.target.value })} /></label><button className="primary-action justify-self-end sm:col-span-2"><Plus size={16} />Crear ubicación</button>
        </fieldset>
      </form>
    </div>}
    {edit && admin && <form className="module-card space-y-4" onSubmit={async e => { e.preventDefault(); if (await save("/api/" + edit.kind + "/" + edit.id, "PATCH", { nombre: edit.nombre, direccion: edit.direccion, activo: edit.activo, ...(edit.kind === "sucursales" ? { telefono: edit.telefono } : {}) }, "Datos actualizados.")) setEdit(null); }}>
      <h3 className="font-semibold text-ink">Editar {edit.kind === "sucursales" ? "sucursal" : "ubicación"}</h3><div className="grid sm:grid-cols-3 gap-3"><label className="form-label">Nombre<input required minLength={2} className="module-input mt-2" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} /></label><label className="form-label">Dirección<input className="module-input mt-2" value={edit.direccion} onChange={e => setEdit({ ...edit, direccion: e.target.value })} /></label>{edit.kind === "sucursales" && <label className="form-label">Teléfono<input className="module-input mt-2" value={edit.telefono} onChange={e => setEdit({ ...edit, telefono: e.target.value })} /></label>}</div><label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} />Activa</label><div className="flex gap-2"><button disabled={saving} className="primary-action">Guardar cambios</button><button type="button" className="theme-toggle" onClick={() => setEdit(null)}>Volver</button></div>
    </form>}
    <section className="space-y-3"><h3 className="text-lg font-semibold text-ink">Almacenes y tiendas configurados</h3><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{locations.map(l =>
      <article key={l.id} className="module-card space-y-3"><div className="flex justify-between items-start gap-3"><div className="flex items-center gap-3">{l.tipo === "TIENDA" ? <Store className="text-[#F06529]" size={24} /> : <Warehouse className="text-[#F06529]" size={24} />}<div><p className="font-semibold text-ink">{l.nombre}</p><span className="text-xs text-muted">{l.esInicial ? "Saldo anterior · por distribuir" : l.tipo === "TIENDA" ? "Tienda" : "Almacén"}</span></div></div>{admin && !l.esInicial && <button className="theme-toggle" aria-label={"Editar " + l.nombre} onClick={() => setEdit({ kind: "ubicaciones", id: l.id, nombre: l.nombre, direccion: l.direccion || "", telefono: "", activo: l.activo })}><Pencil size={14} /></button>}</div>
        <p className="text-sm text-secondary">{l.sucursal?.nombre || (l.esInicial ? "Distribución inicial pendiente" : "Central · compartido")}</p>{l.direccion && <p className="text-xs text-muted flex gap-2"><MapPin size={14} />{l.direccion}</p>}
        {l.activo ? <Link className="text-xs text-[#F06529] font-semibold" href={"/inventario?ubicacionId=" + encodeURIComponent(l.id)}>Ver existencias →</Link> : <span className="text-xs text-muted">Inactiva</span>}
      </article>)}</div>{!locations.length && <p className="module-note">Crea tu primer almacén y las tiendas de las sucursales para comenzar.</p>}</section>
    <section className="space-y-3"><h3 className="text-lg font-semibold text-ink">Sucursales</h3><div className="grid md:grid-cols-2 gap-4">{branches.map(b =>
      <article className="module-card" key={b.id}><div className="flex justify-between items-center gap-3"><h4 className="font-semibold text-ink flex gap-2 items-center"><Building2 size={18} />{b.nombre}</h4>{admin && <button className="theme-toggle" aria-label={"Editar " + b.nombre} onClick={() => setEdit({ kind: "sucursales", id: b.id, nombre: b.nombre, direccion: b.direccion || "", telefono: b.telefono || "", activo: b.activo })}><Pencil size={14} /></button>}</div><p className="text-sm text-muted mt-3">{b.direccion || "Sin dirección registrada"}{b.telefono ? " · " + b.telefono : ""}</p><p className="text-xs text-secondary mt-3">{b.ubicaciones.filter(l => (l as any).activo).length} ubicaciones · {b.usuarios.length} usuarios · {b.activo ? "Activa" : "Inactiva"}</p><p className="text-xs text-muted mt-2">{b.usuarios.map(u => u.nombre).join(", ") || "Sin personal asignado"}</p></article>)}</div></section>
    {admin && <form className="module-card space-y-4" onSubmit={async e => { e.preventDefault(); if (await save("/api/sucursales/" + assign.sucursalId, "PATCH", { usuarioId: assign.usuarioId }, "Personal asignado a la sucursal.")) setAssign({ usuarioId: "", sucursalId: "" }); }}>
      <h3 className="font-semibold text-ink flex gap-2 items-center"><Users size={18} />Asignar personal a una sucursal</h3><p className="text-sm text-muted">El encargado y los técnicos operan el inventario de la sucursal asignada. Los almacenes centrales son gestionados por el administrador.</p><fieldset disabled={saving} className="grid sm:grid-cols-3 gap-3"><label className="form-label">Usuario<select required className="module-input mt-2" value={assign.usuarioId} onChange={e => setAssign({ ...assign, usuarioId: e.target.value })}><option value="">Seleccionar</option>{users.map(u => <option key={u.id} value={u.id}>{u.nombre} · {u.rol}</option>)}</select></label><label className="form-label">Sucursal<select required className="module-input mt-2" value={assign.sucursalId} onChange={e => setAssign({ ...assign, sucursalId: e.target.value })}><option value="">Seleccionar</option>{branches.filter(b => b.activo).map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select></label><button className="primary-action self-end">Asignar</button></fieldset>
    </form>}
  </div>;
}
