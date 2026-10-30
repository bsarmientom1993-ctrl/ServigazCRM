'use client';

import {useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,Clock3,Flame,Sparkles} from 'lucide-react';

import {AttendanceMotivation} from './AttendanceMotivation';
type Window={puedeMarcar:boolean;motivo:string;horario:{desde:string;hasta:string}|null};
export function AttendanceWelcome({name,access,entered=false,finished=false,exempt=false,onPrepare,prepareHref='#marcacion-del-dia'}:{name:string;access:Window;entered?:boolean;finished?:boolean;exempt?:boolean;onPrepare?:()=>void;prepareHref?:string}){
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
 const firstName=name.trim().split(/\s+/)[0]||'equipo';
 const date=now?.toLocaleDateString('es-BO',{timeZone:'America/La_Paz',weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const time=now?.toLocaleTimeString('es-BO',{timeZone:'America/La_Paz',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 return <section className="module-card !p-5 sm:!p-7 relative overflow-hidden !border-orange-500/25" aria-label="Bienvenida a tu jornada">
  <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-gradient-to-br from-orange-500/10 via-transparent to-sky-500/5"/>
  <div className="relative space-y-5">
   <div className="flex items-start justify-between gap-3"><div><p className="module-eyebrow flex items-center gap-2"><Flame size={16} className="text-orange-500"/> TU DÍA EN SERVIGAZ</p><h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{finished?'¡Buen trabajo,':entered?'¡Vamos con todo,':'¡Qué gusto verte,'} <span className="text-orange-500">{firstName}!</span></h1><p className="text-sm text-muted mt-2">{finished?'Gracias por todo lo que aportaste hoy. Tu jornada quedó registrada.':entered?'Tu entrada está registrada. Tu equipo y tus próximos trabajos te esperan.':exempt?'Bienvenido a tu espacio. Tienes acceso permanente como administrador general.':'Un nuevo día para conectar, resolver y hacer las cosas bien.'}</p></div><span className="rounded-2xl bg-orange-500/10 p-3 text-orange-500 shrink-0"><Sparkles size={24}/></span></div>
   <div className="grid sm:grid-cols-2 gap-3"><div className="rounded-2xl bg-canvas border border-line p-4"><p className="text-xs text-muted flex gap-2 items-center"><Clock3 size={14}/> HORA DE BOLIVIA</p><time dateTime={now?.toISOString()} className="text-3xl sm:text-4xl font-semibold tabular-nums block mt-2" aria-label="Hora actual en Bolivia">{time||'--:--:--'}</time><p className="text-xs text-muted capitalize mt-2">{date||'Preparando tu día…'}</p></div><div className="rounded-2xl border border-line p-4 flex flex-col justify-center gap-2"><span className="text-xs font-semibold text-orange-500">{exempt?'ADMINISTRACIÓN GENERAL':finished?'JORNADA COMPLETADA':entered?'ENTRADA CONFIRMADA':access.puedeMarcar?'ES MOMENTO DE COMENZAR':'TU JORNADA, ORGANIZADA'}</span><p className="font-semibold">{exempt?'Acceso permanente · sin marcación obligatoria':access.horario?`Puedes marcar de ${access.horario.desde} a ${access.horario.hasta}`:'Tu horario está pendiente de configuración'}</p><p className="text-xs text-muted">{exempt?'Gestiona el equipo y la operación en cualquier momento.':entered?'Consulta tus tareas y avanza con tu equipo.':access.motivo||'Incluye los márgenes autorizados. Acércate al ingreso de tu sucursal para marcar.'}</p></div></div>
   <AttendanceMotivation/>
   {!exempt&&<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted flex items-center gap-2">{entered?<CheckCircle2 size={17} className="text-emerald-500"/>:<Clock3 size={17}/>} {entered?'Tu jornada está registrada.':'Primero tu entrada, luego tus próximos objetivos.'}</p>{!finished&&(onPrepare?<button className="primary-action" onClick={onPrepare}>{entered?'Ver mi marcación':'Preparar mi entrada'}<ArrowRight size={16}/></button>:<a className="primary-action" href={prepareHref}>{entered?'Ver mi marcación':'Preparar mi entrada'}<ArrowRight size={16}/></a>)}</div>}
  </div>
 </section>;
}
