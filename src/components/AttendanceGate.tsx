'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {PersonnelWorkspace} from './PersonnelWorkspace';
import {NotificationCenter} from './NotificationCenter';
import {AttendanceWelcome} from './AttendanceWelcome';

type Access={fecha:string;marcada:boolean;requiereAsistencia:boolean;puedeMarcar:boolean;horario:{entrada:string;salida:string;desde:string;hasta:string}|null;motivo:string};
export function AttendanceGate({children}:{children:React.ReactNode}){
 const {user,logout}=useAuth(),pathname=usePathname();
 const exempt=user?.roles?.includes('ADMIN')||user?.rol==='ADMIN';
 const [status,setStatus]=useState<Access|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(exempt)return;let alive=true;let controller:AbortController|null=null;
  const check=async()=>{controller?.abort();controller=new AbortController();try{const r=await fetch('/api/personal/acceso',{cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo comprobar tu asistencia.');if(alive){setStatus(data);setError('');}}catch(e){if(alive&&(e as Error).name!=='AbortError'){setStatus(null);setError((e as Error).message);}}};
  void check();const tick=setInterval(()=>void check(),30000),focus=()=>void check();window.addEventListener('focus',focus);window.addEventListener('servigaz:attendance-changed',focus);
  return()=>{alive=false;controller?.abort();clearInterval(tick);window.removeEventListener('focus',focus);window.removeEventListener('servigaz:attendance-changed',focus);};
 },[user?.id,pathname,retry,exempt]);
 if(exempt)return children;
 if(!status)return <main className="min-h-screen bg-canvas text-ink p-6 flex items-center justify-center"><section className="module-card space-y-4 max-w-lg"><h1 className="text-xl font-semibold">Comprobando tu jornada</h1><p role={error?'alert':'status'}>{error||'Consultando la asistencia de hoy…'}</p>{error&&<button className="primary-action" onClick={()=>setRetry(n=>n+1)}>Reintentar</button>}<button className="theme-toggle" onClick={()=>void logout()}>Cerrar sesión</button></section></main>;
 if(!status.requiereAsistencia)return children;
 return <main className="min-h-screen bg-canvas text-ink"><div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-5"><AttendanceWelcome name={user?.nombre||''} access={status} prepareHref="/asistencia#marcacion-del-dia"/><section className="module-card !py-4 space-y-3"><p className="text-sm text-muted">Registra la entrada de hoy para acceder a tus tareas. Una entrada habilita todos tus roles durante esta jornada.</p><div className="flex flex-wrap gap-3"><Link href="/asistencia" className="theme-toggle">Mi asistencia</Link><Link href="/notificaciones" className="theme-toggle">Notificaciones</Link><button className="theme-toggle" onClick={()=>void logout()}>Cerrar sesión</button></div></section>{pathname==='/notificaciones'?<NotificationCenter full key={user?.id}/>:<PersonnelWorkspace attendanceOnly clockAccess={status} key={user?.id+':'+status.fecha}/>}</div></main>;
}
