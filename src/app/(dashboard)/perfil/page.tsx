"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { UserRound, Users } from "lucide-react";
import {UserRoleEditor} from '@/components/UserRoleEditor';
import {roleLabels,type UserRole} from '@/lib/user-roles';
type Profile = { id: string; nombre: string; telefono?: string | null; email: string; rol: string; roles?:UserRole[]; estado?: string; sucursal?: { nombre: string } };
const roles:Record<string,string> = roleLabels;
export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const [name, setName] = useState(""), [phone, setPhone] = useState("");
  const [teamQuery,setTeamQuery]=useState("");
  const [users, setUsers] = useState<Profile[]>([]), [editing, setEditing] = useState<Profile | null>(null);
  const [error, setError] = useState(""), [teamError, setTeamError] = useState(""), [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false), [teamLoading, setTeamLoading] = useState(false); const busy = useRef(false);
  useEffect(() => { setName(user?.nombre || ""); setPhone(user?.telefono || ""); }, [user?.id, user?.nombre, user?.telefono]);
  async function loadTeam() {
    setTeamLoading(true); setTeamError("");
    try { const res = await fetch("/api/usuarios"); const data = await res.json(); if (!res.ok) throw new Error(data.error || "No se pudo cargar el equipo."); setUsers(data); }
    catch (err: any) { setTeamError(err.message); } finally { setTeamLoading(false); }
  }
  useEffect(() => { if (user?.rol === "ADMIN") loadTeam(); }, [user?.id, user?.rol]);
  async function save(target?: Profile) {
    if (busy.current) return; busy.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(target ? "/api/usuarios/" + target.id : "/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: target?.nombre ?? name, telefono: target ? target.telefono || "" : phone }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo guardar el perfil.");
      if (!target || target.id === user?.id) await refreshUser();
      if (user?.rol === "ADMIN") await loadTeam();
      setEditing(null); setSuccess("Perfil guardado. Las nuevas operaciones se identificarán con este nombre.");
    } catch (err: any) { setError(err.message); } finally { busy.current = false; setSaving(false); }
  }
  if (loading) return <p className="module-note">Cargando tu perfil…</p>;
  if (!user) return null;
  return <div className="max-w-5xl mx-auto space-y-6">
    <section className="module-card space-y-4"><p className="module-eyebrow">TU IDENTIDAD EN SERVIGAZ</p><h2 className="text-2xl font-semibold text-ink flex items-center gap-3"><UserRound />Mi perfil</h2><p className="text-sm text-secondary">Usa tu nombre para identificar tus cotizaciones y las acciones que realizas en cada orden. La firma de las cotizaciones muestra tu nombre sin añadir el cargo.</p><p className="module-note">Cada persona debe trabajar con su propia cuenta. Las cotizaciones emitidas conservan el nombre que tenían al emitirse.</p>
      {error && <p role="alert" className="module-error">{error}</p>}{success && <p role="status" className="module-success">{success}</p>}
      <form onSubmit={e => { e.preventDefault(); save(); }}><fieldset disabled={saving} className="space-y-4"><div className="grid sm:grid-cols-2 gap-4"><label className="form-label">Nombre completo<input required minLength={3} maxLength={150} autoComplete="name" className="module-input mt-2" value={name} onChange={e => setName(e.target.value)} /></label><label className="form-label">Teléfono<input maxLength={40} autoComplete="tel" className="module-input mt-2" value={phone} onChange={e => setPhone(e.target.value)} /></label></div><p className="text-sm text-muted">{user.email} · {roles[user.rol]} · {user.rol === "ENCARGADO_TIENDA" ? "Todas las tiendas" : user.sucursal || "Sin sucursal asignada"}</p><button type="submit" className="primary-action">{saving ? "Guardando…" : "Guardar mi perfil"}</button></fieldset></form>
    </section>
    {user.rol === "ADMIN" && <section className="module-card space-y-4"><h2 className="text-xl font-semibold text-ink flex items-center gap-3"><Users />Usuarios y roles</h2><p className="text-sm text-secondary">Configura la identidad de cada persona y marca los roles que podrá utilizar. Los cambios quedan registrados en el historial de administración.</p>
      <label className="form-label block">Buscar personal<input className="module-input mt-2" value={teamQuery} onChange={e=>setTeamQuery(e.target.value)} placeholder="Nombre o correo del usuario"/></label>
      {teamError && <div role="alert" className="module-error">{teamError}<button className="theme-toggle ml-3" onClick={loadTeam}>Reintentar</button></div>}
      {teamLoading && !users.length ? <p role="status" className="module-note">Cargando equipo…</p> : <div className="space-y-3">{users.filter(member=>(member.nombre+" "+member.email).toLocaleLowerCase().includes(teamQuery.toLocaleLowerCase())).map(member => <div key={member.id} className="rounded-xl border border-line p-4">
        {editing?.id === member.id ? <form onSubmit={e => { e.preventDefault(); save(editing); }}><fieldset disabled={saving} className="space-y-3"><h3 className="font-semibold text-ink">Editar perfil de {member.nombre}</h3><div className="grid sm:grid-cols-2 gap-3"><label className="form-label">Nombre del usuario<input className="module-input mt-2" required minLength={3} maxLength={150} value={editing.nombre} onChange={e => setEditing({ ...editing, nombre: e.target.value })} /></label><label className="form-label">Teléfono del usuario<input className="module-input mt-2" maxLength={40} value={editing.telefono || ""} onChange={e => setEditing({ ...editing, telefono: e.target.value })} /></label></div><div className="flex gap-3"><button className="primary-action" type="submit">Guardar usuario</button><button type="button" className="theme-toggle" onClick={() => setEditing(null)}>Cancelar</button></div></fieldset></form> : <div className="flex flex-wrap justify-between items-center gap-3"><div><p className="font-semibold text-ink">{member.nombre}</p><p className="text-xs text-muted mt-1">{member.email} · {(member.roles||[member.rol]).map(role=>roles[role]).join(" + ")} · {member.sucursal?.nombre || "Sin sucursal"} · {member.estado === "ACTIVO" ? "Activo" : "Inactivo"}</p></div><button disabled={saving} className="theme-toggle" aria-label={"Editar perfil de " + member.nombre} onClick={() => { setEditing({ ...member }); setError(""); setSuccess(""); }}>Editar perfil</button></div>}
        <UserRoleEditor member={member} onSaved={async id=>{await loadTeam();if(id===user.id)await refreshUser();}}/>
      </div>)}</div>}
    </section>}
  </div>;
}
