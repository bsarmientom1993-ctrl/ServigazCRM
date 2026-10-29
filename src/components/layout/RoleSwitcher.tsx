"use client";
import {useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {roleLabels,roleHome} from '@/lib/user-roles';
export function RoleSwitcher(){
  const {user}=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!user||!user.roles||user.roles.length<2)return null;
  async function change(rol:string){if(busy)return;setBusy(true);setError('');try{const res=await fetch('/api/auth/rol',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rol})});const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo cambiar el rol.');window.location.assign(roleHome(rol));}catch(e){setError((e as Error).message);setBusy(false);}}
  return <div className="max-w-44 sm:max-w-56"><label className="text-xs text-muted">Rol activo<select aria-label="Cambiar rol activo" disabled={busy} value={user.rol} onChange={e=>void change(e.target.value)} className="module-input text-xs py-2">{user.roles.map(role=><option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>{error&&<p role="alert" className="text-xs text-red-500">{error}</p>}</div>;
}
