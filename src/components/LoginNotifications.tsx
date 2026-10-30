'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Bell,CheckCircle2,X} from 'lucide-react';
import type {UserSession} from '@/context/AuthContext';
import {roleLabels} from '@/lib/user-roles';

type PendingNotice={id:string;titulo:string;mensaje:string};
export function LoginNotifications({user}:{user:UserSession}){
 const [notices,setNotices]=useState<PendingNotice[]>([]),[count,setCount]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[dismissed,setDismissed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  fetch('/api/notificaciones?pendientes=1',{cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudieron consultar tus notificaciones.');return data;})
   .then(data=>{setNotices(data.notificaciones.slice(0,3));setCount(data.noLeidas);})
   .catch(e=>{if(e.name!=='AbortError')setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[user.id,user.rol,retry]);
 if(dismissed)return null;
 return <section className="module-card mb-5 border-l-4 !border-l-orange-500" aria-label="Notificaciones al ingresar">
  <div className="flex items-start justify-between gap-3"><div className="flex gap-3 min-w-0"><span className="rounded-xl bg-orange-500/10 p-2.5 text-orange-500 shrink-0 self-start"><Bell size={22}/></span><div className="min-w-0"><p className="module-eyebrow !mb-1">BIENVENIDO A SERVIGAZ</p><h2 className="text-lg font-semibold">Hola, {user.nombre}</h2><p className="text-xs text-muted mt-1">{roleLabels[user.rol]} · Tus notificaciones al ingresar</p></div></div><button type="button" className="theme-toggle shrink-0" aria-label="Cerrar resumen de notificaciones" onClick={()=>setDismissed(true)}><X size={17}/></button></div>
  <div className="mt-4" aria-live="polite">{loading?<p className="text-sm text-muted" role="status">Consultando tus notificaciones…</p>:error?<div className="space-y-3"><p className="module-error text-sm" role="alert">{error}</p><button className="theme-toggle" type="button" onClick={()=>setRetry(n=>n+1)}>Volver a consultar</button></div>:<><p className="flex items-center gap-2 text-sm font-semibold">{count>0?<><Bell size={16}/>{count===1?'Tienes una notificación pendiente.':'Tienes '+count+' notificaciones pendientes.'}</>:<><CheckCircle2 size={18} className="text-emerald-500"/>No tienes notificaciones pendientes.</>}</p>{notices.length>0&&<ul className="grid md:grid-cols-3 gap-3 mt-3">{notices.map(n=><li key={n.id} className="rounded-xl border border-line bg-canvas p-3"><h3 className="text-sm font-semibold">{n.titulo}</h3><p className="text-xs text-secondary mt-1 leading-relaxed">{n.mensaje}</p></li>)}</ul>}<div className="flex flex-wrap items-center gap-3 mt-4"><Link href="/notificaciones" onClick={()=>setDismissed(true)} className="primary-action">{count?'Revisar mis notificaciones':'Abrir notificaciones'}</Link><button type="button" className="theme-toggle" onClick={()=>setDismissed(true)}>Continuar trabajando</button>{count>3&&<span className="text-xs text-muted">Y {count-3} más por revisar.</span>}</div></>}</div>
 </section>;
}
