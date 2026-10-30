'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Flame,Loader2,MapPin,X} from 'lucide-react';
import {AttendanceMotivation} from './AttendanceMotivation';

type Access={puedeMarcar:boolean;motivo:string;horario:{desde:string;hasta:string}|null};
async function request(path:string,body?:unknown,key?:string){const r=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo consultar tu jornada.');return data;}
export function AttendanceClockModal({name,type='ENTRADA',required=false,onClose,onReview,onMarked}:{name:string;type?:'ENTRADA'|'SALIDA';required?:boolean;onClose:()=>void;onReview:()=>void;onMarked:()=>Promise<void>|void}){
 const dialog=useRef<HTMLDialogElement>(null),finishTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [now,setNow]=useState<Date|null>(null),[branches,setBranches]=useState<{id:string;nombre:string}[]>([]),[branch,setBranch]=useState(''),[access,setAccess]=useState<Access|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const el=dialog.current,previous=document.activeElement as HTMLElement|null;el?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{if(finishTimer.current)clearTimeout(finishTimer.current);el?.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const controller=new AbortController();let alive=true;setLoading(true);setError('');
  fetch('/api/personal',{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo cargar tu asistencia.');return d;}).then(d=>{if(!alive)return;const allowed=d.configuracion?.sucursalesAutorizadas||[];const items=d.sucursales.filter((b:{id:string})=>allowed.includes(b.id));setBranches(items);setBranch(old=>items.some((b:{id:string})=>b.id===old)?old:items.length===1?items[0].id:'');setAccess(d.acceso);}).catch(e=>{if(alive&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(alive)setLoading(false);});
  const refresh=()=>{void request('/api/personal/acceso').then(d=>{if(alive)setAccess(d);}).catch(()=>{if(alive)setAccess(null);});};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);
  return()=>{alive=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[retry]);
 async function mark(){if(busy||success)return;setBusy(true);setError('');try{
  if(!navigator.geolocation)throw Error('Este dispositivo no ofrece ubicación. Solicita una revisión.');
  const ready=await request('/api/personal/marcacion',{accion:'PREPARAR',tipo:type,sucursalId:branch});
  const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,e=>reject(Error(e.code===1?'Permite la ubicación precisa para marcar tu asistencia.':'No se obtuvo una ubicación precisa. Acércate al ingreso o solicita revisión.')),{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
  await request('/api/personal/marcacion',{accion:'MARCAR',tipo:type,sucursalId:branch,token:ready.token,ubicacion:{latitud:position.coords.latitude,longitud:position.coords.longitude,precisionMetros:position.coords.accuracy,muestraAt:new Date(position.timestamp).toISOString()}},crypto.randomUUID());
  setSuccess(true);finishTimer.current=setTimeout(()=>{void Promise.resolve(onMarked()).catch(()=>setError('La marcación se guardó. Actualiza la página para comprobar tu acceso.'));},1000);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const first=name.trim().split(/\s+/)[0]||'equipo';
 return <dialog ref={dialog} className="attendance-clock-dialog" aria-labelledby="attendance-clock-title" aria-describedby="attendance-clock-description" onCancel={e=>{e.preventDefault();if(!required&&!busy&&!success)onClose();}}>
  <div className="attendance-clock-shell">
   <header className="attendance-clock-header"><div className="min-w-0"><p className="module-eyebrow !mb-1 flex items-center gap-1.5"><Flame size={13}/> SERVIGAZ · TU JORNADA</p><h2 id="attendance-clock-title" className="text-xl sm:text-2xl font-semibold">{success?'¡Todo listo,':'¡Qué gusto verte,'} <span className="text-orange-500">{first}!</span></h2></div>{!required&&<button className="theme-toggle" aria-label="Cerrar marcación" disabled={busy||success} onClick={onClose}><X size={17}/></button>}</header>
   <div className="attendance-clock-body">
    <div className="text-center"><time className="text-4xl sm:text-5xl font-semibold tabular-nums" aria-label="Hora actual en Bolivia">{now?.toLocaleTimeString('es-BO',{timeZone:'America/La_Paz',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})||'--:--:--'}</time><p className="text-xs text-muted mt-1 capitalize">{now?.toLocaleDateString('es-BO',{timeZone:'America/La_Paz',weekday:'long',day:'numeric',month:'long'})} · Bolivia</p></div>
    <AttendanceMotivation/>
    {success?<div className="text-center space-y-2 py-3" role="status"><CheckCircle2 className="mx-auto text-emerald-500" size={36}/><p className="font-semibold">{type==='ENTRADA'?'Entrada confirmada. ¡Vamos con todo!':'Salida confirmada. ¡Gracias por tu trabajo!'}</p></div>:<>
     <p id="attendance-clock-description" className="text-xs text-muted text-center">{access?.horario?`Horario autorizado: ${access.horario.desde} a ${access.horario.hasta}`:'Tu jornada debe estar habilitada por el administrador.'}</p>
     {loading?<p className="text-sm" role="status">Preparando tu marcación…</p>:<label className="form-label block">Sucursal<select autoFocus className="module-input mt-1" value={branch} disabled={busy} onChange={e=>setBranch(e.target.value)}><option value="">Seleccionar sucursal</option>{branches.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}</select></label>}
     <p className="text-xs text-muted flex items-start gap-2"><MapPin size={15} className="shrink-0"/>Ubícate dentro de los 10 metros del ingreso. La ubicación se solicita al marcar.</p>
     {access?.motivo&&<p className="text-xs text-orange-500">{access.motivo}</p>}
    </>}
    {error&&<div className="module-error text-xs" role="alert">{error}{!access&&<button className="underline ml-2" onClick={()=>setRetry(n=>n+1)}>Reintentar</button>}</div>}
   </div>
   <footer className="attendance-clock-footer"><button className="primary-action w-full justify-center !py-3" disabled={busy||loading||success||!branch||!access?.puedeMarcar} onClick={()=>void mark()}>{busy?<><Loader2 size={17} className="animate-spin"/>Comprobando ubicación…</>:success?'Asistencia guardada':type==='ENTRADA'?'Marcar mi entrada':'Marcar mi salida'}</button><button className="text-xs text-muted underline" disabled={busy||success} onClick={onReview}>No puedo marcar · solicitar revisión</button></footer>
  </div>
 </dialog>;
}
