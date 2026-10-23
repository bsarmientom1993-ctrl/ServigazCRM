"use client";
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { QuoteLetter } from '@/components/QuoteLetter';

export default function CartaPage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = use(params);
  const [work,setWork] = useState<any>(null), [error,setError] = useState('');
  useEffect(()=>{const controller=new AbortController();fetch('/api/trabajos/'+id,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error || 'No se pudo cargar la cotización.');setWork(data);}).catch(err=>{if(err.name!=='AbortError')setError(err.message);});return()=>controller.abort();},[id]);
  if(error)return <p role="alert" className="module-error">{error}</p>;
  if(!work)return <p className="module-note">Cargando carta de cotización…</p>;
  const quote=work.cotizaciones?.find((item:any)=>item.id===quoteId);
  if(!quote)return <p role="alert" className="module-error">La cotización no está disponible.</p>;
  return <div className="space-y-5"><div className="letter-toolbar flex flex-wrap gap-3"><Link href={'/trabajos/'+id} className="theme-toggle">Volver al trabajo</Link><button className="primary-action" onClick={()=>window.print()}>Imprimir / Guardar PDF</button><p className="text-xs text-muted self-center">Selecciona «Guardar como PDF» en el diálogo de impresión.</p></div><div className="quote-letter-frame"><QuoteLetter work={work} quote={quote}/></div></div>;
}
