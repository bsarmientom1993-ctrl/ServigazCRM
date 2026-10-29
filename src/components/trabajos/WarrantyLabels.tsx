'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Printer, ShieldCheck, ShieldAlert, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { sealWarning } from '@/lib/warranty-labels';
export type WarrantyLabel = { id:string;codigo:string;operacion:string;equipo:string;marca:string;modelo:string;serie:string;cobertura:string;condiciones:string;fechaInicio:string;fechaFin:string;emitidaPorNombre:string;estado:string;anuladaAt:string|null;anuladaPorNombre:string|null;motivoAnulacion:string|null };
type LabelsData={codigoTrabajo:string;etiquetas:WarrantyLabel[];config:{activo:boolean;mesesDefecto:number;condiciones:string|null}|null};
const date=(d:string)=>new Date(d).toLocaleDateString('es-BO',{timeZone:'America/La_Paz'});
async function read(res:Response){const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo guardar la etiqueta.');return data;}
export function SealPreview({label,workCode}:{label:WarrantyLabel;workCode:string}) {
  return <article className={'warranty-seal '+(label.estado!=='VIGENTE'?'warranty-seal-void':'')} aria-label="Etiqueta de garantía de 70 por 40 milímetros">
    <header><strong>SERVIGAZ</strong><span>SELLO DE GARANTÍA</span></header>
    <div className="seal-code">{label.codigo}</div>
    <div className="seal-equipment"><strong>{label.equipo}</strong><span>{label.marca} · {label.modelo}</span><span>Serie: {label.serie||'Identificado por código de sello'}</span></div>
    <div className="seal-dates"><span>Desde: <b>{date(label.fechaInicio)}</b></span><span>Hasta: <b>{date(label.fechaFin)}</b></span></div>
    <p className="seal-coverage">{label.operacion==='VENTA'?'Venta':'Revisión'}: {label.cobertura}</p>
    <p className="seal-warning">{label.estado==='VIGENTE'?sealWarning:label.estado+' · NO VÁLIDA PARA COBERTURA'}</p>
    <footer><span>{workCode}</span><span>Emitió: {label.emitidaPorNombre}</span></footer>
  </article>;
}
export function WorkWarrantyLabels({workId}:{workId:string}) {
  const {user}=useAuth();
  const [data,setData]=useState<LabelsData|null>(null),[error,setError]=useState(''),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({operacion:'REVISION',equipo:'',marca:'',modelo:'',serie:'',cobertura:''});
  const key=useRef(''),snapshot=useRef('');
  useEffect(()=>{let active=true;fetch(`/api/trabajos/${workId}/etiquetas`).then(read).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[workId]);
  async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
    const json=JSON.stringify(form);if(snapshot.current!==json){key.current=crypto.randomUUID();snapshot.current=json;}
    const label=await read(await fetch(`/api/trabajos/${workId}/etiquetas`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key.current},body:json}));
    setData(await read(await fetch(`/api/trabajos/${workId}/etiquetas`)));setOpen(false);key.current='';snapshot.current='';
    window.location.assign(`/trabajos/${workId}/etiquetas/${label.id}`);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="module-card space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck size={21}/>Etiquetas de garantía</h2><p className="text-sm text-muted">Un sello por equipo revisado o vendido, con su cobertura y trazabilidad.</p></div><button type="button" className="theme-toggle" onClick={()=>setOpen(!open)}><Plus size={16}/>{open?'Cerrar formulario':'Emitir etiqueta'}</button></div>
    {error&&<p role="alert" className="module-error">{error}</p>}
    {data&&!data.config?.activo&&<p className="module-note">El administrador debe configurar la garantía de este servicio antes de emitir etiquetas.</p>}
    {open&&<form onSubmit={save} className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Operación<select aria-label="Operación de la etiqueta" value={form.operacion} onChange={e=>setForm({...form,operacion:e.target.value})} className="form-input mt-1"><option value="REVISION">Revisión / mantenimiento</option>{user?.rol!=='TECNICO_FIJO'&&<option value="VENTA">Venta de equipo</option>}</select></label>
      {(['equipo','marca','modelo','serie'] as const).map(k=><label className="text-sm" key={k}>{{equipo:'Equipo',marca:'Marca',modelo:'Modelo',serie:'Número de serie (opcional)'}[k]}<input className="form-input mt-1" required={k!=='serie'} maxLength={{equipo:45,marca:30,modelo:35,serie:45}[k]} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div>
      <label className="text-sm block">Cobertura de esta operación<input required maxLength={120} className="form-input mt-1" placeholder="Ej.: mantenimiento y cambio de membrana realizados" value={form.cobertura} onChange={e=>setForm({...form,cobertura:e.target.value})}/></label>
      <p className="text-xs text-muted">Describe únicamente lo revisado, reparado o vendido. Vigencia configurada: {data?.config?.mesesDefecto||'—'} meses desde la emisión. Una revisión no cubre automáticamente otras fallas del equipo.</p>
      <button className="primary-action" disabled={busy||!data?.config?.activo}>{busy?'Emitiendo…':'Guardar y preparar impresión'}</button>
    </form>}
    {data?.etiquetas.length===0&&<p className="text-sm text-muted">Sin etiquetas emitidas. Registra primero la revisión realizada o la venta aceptada.</p>}
    <div className="grid md:grid-cols-2 gap-3">{data?.etiquetas.map(label=><div key={label.id} className="rounded-xl border border-line p-4 space-y-2"><div className="flex justify-between gap-2"><strong>{label.equipo}</strong><span className={label.estado==='VIGENTE'?'text-emerald-600':'text-red-500'}>{label.estado}</span></div><p className="text-sm">{label.marca} · {label.modelo} · {label.serie||'Sin serie de fabricante'}</p><p className="font-mono text-xs">{label.codigo}</p><p className="text-xs text-muted">Emitió {label.emitidaPorNombre} · Hasta {date(label.fechaFin)}</p><Link className="theme-toggle" href={`/trabajos/${workId}/etiquetas/${label.id}`}><Printer size={16}/>Ver etiqueta e historial</Link></div>)}</div>
  </section>;
}
export function WarrantyLabelPrint({workId,labelId}:{workId:string;labelId:string}) {
  const [data,setData]=useState<LabelsData|null>(null),[error,setError]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;fetch(`/api/trabajos/${workId}/etiquetas`).then(read).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[workId]);
  const label=data?.etiquetas.find(l=>l.id===labelId);
  async function broken(e:React.FormEvent){e.preventDefault();if(!confirmed||busy)return;setBusy(true);setError('');try{
    await read(await fetch(`/api/trabajos/${workId}/etiquetas`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({etiquetaId:labelId,motivo:reason,selloRotoConfirmado:true})}));
    setData(await read(await fetch(`/api/trabajos/${workId}/etiquetas`)));setReason('');setConfirmed(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="seal-print-page space-y-6"><div className="print:hidden flex flex-wrap justify-between gap-3"><Link className="theme-toggle" href={`/trabajos/${workId}`}><ArrowLeft size={16}/>Volver al trabajo</Link><button className="primary-action" disabled={!label||label.estado!=='VIGENTE'} onClick={()=>window.print()}><Printer size={17}/>Imprimir etiqueta · 70 × 40 mm</button></div>
    {error&&<p className="module-error print:hidden" role="alert">{error}</p>}
    {!data?<p className="print:hidden">Cargando etiqueta…</p>:!label?<p className="module-error print:hidden">Etiqueta no encontrada en este trabajo.</p>:<>
      <div className="print:hidden"><h1 className="text-2xl font-semibold">Sello de garantía</h1><p className="text-muted mt-2">Imprime al 100 %, sin ajustar a página y sin encabezados ni pies del navegador. Utiliza una etiqueta destructible o VOID y colócala sobre la unión de apertura del equipo, lejos de superficies calientes.</p></div>
      <SealPreview label={label} workCode={data.codigoTrabajo}/>
      <section className="module-card print:hidden space-y-3"><h2 className="font-semibold">Registro de la etiqueta</h2><p>Estado: <strong>{label.estado}</strong></p><p>Emitida por {label.emitidaPorNombre} el {date(label.fechaInicio)}. Vigencia hasta {date(label.fechaFin)}.</p><p>Cobertura: {label.cobertura}</p>{label.condiciones&&<p className="whitespace-pre-wrap text-sm">Condiciones: {label.condiciones}</p>}
        <p className="text-sm text-muted">Reimprimir conserva el mismo código y la misma vigencia. Esta etiqueta identifica únicamente el equipo y la cobertura indicados.</p>
        {label.anuladaAt?<div className="module-error"><p>Anulada por {label.anuladaPorNombre} el {date(label.anuladaAt)}.</p><p>Motivo: {label.motivoAnulacion}</p></div>:<form onSubmit={broken} className="border-t border-line pt-4 space-y-3"><h3 className="font-semibold flex gap-2 items-center"><ShieldAlert size={18}/>Registrar sello roto o manipulado</h3><label className="block text-sm">Detalle de lo observado<textarea required minLength={10} maxLength={500} className="form-input mt-1" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe la rotura o manipulación detectada"/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que revisé el sello físico y está roto o manipulado. Se anulará la cobertura de esta etiqueta.</label><button className="theme-toggle text-red-600" disabled={!confirmed||reason.trim().length<10||busy}>{busy?'Registrando…':'Anular por sello roto'}</button></form>}
      </section></>}
  </div>;
}
