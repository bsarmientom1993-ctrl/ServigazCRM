'use client';
import { useEffect, useState } from 'react';
import { QuoteLetter } from './QuoteLetter';
import { defaultQuoteTemplate, QuoteTemplate } from '@/lib/quote-template';

const previewWork = { codigoCorrelativo: 'VISTA PREVIA · EJEMPLO', subtipoNombre: 'Instalación de equipos', cliente: { nombreCompleto: 'Cliente de ejemplo', direccion: 'Dirección de ejemplo' } };
const previewQuote = { numeroVersion: 1, estado: 'EJEMPLO', createdAt: '2026-10-23T12:00:00-04:00', fechaVencimiento: '2026-11-07T23:59:59-04:00', subtotalMateriales: 1200, subtotalManoObra: 800, montoTransporte: 100, totalCotizado: 2100, anticipoMinimoRequerido: 1050 };
const fields: [keyof QuoteTemplate, string, number][] = [['empresa','Nombre de la empresa',150],['titulo','Título del documento',80],['tituloAlcance','Título del alcance',120],['tituloPresupuesto','Título del presupuesto',120],['introduccion','Introducción',600],['despedida','Despedida de la firma',100],['pieTexto','Direcciones y contactos del pie',1000]];

export function QuoteTemplateSettings() {
  const [format, setFormat] = useState<QuoteTemplate>({ ...defaultQuoteTemplate });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/configuracion/cotizaciones', { signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo cargar el formato.'); setFormat(result.formato); setLoaded(true); setLoading(false);
    }).catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, []);
  function update<K extends keyof QuoteTemplate>(key: K, value: QuoteTemplate[K]) { setFormat(current => ({ ...current, [key]: value })); setMessage(''); }
  async function upload(key: 'encabezadoImagen' | 'pieImagen', file?: File) {
    if (!file) return;
    setError(''); setMessage('');
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 512000) { setError('Usa imágenes PNG, JPG o WebP de hasta 500 KB.'); return; }
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('No se pudo leer la imagen.')); reader.readAsDataURL(file); });
      update(key, data);
    } catch (err: any) { setError(err.message); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/configuracion/cotizaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(format) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo guardar el formato.');
      setFormat(result.formato); setMessage('Formato guardado. Se aplicará a las nuevas cotizaciones.');
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  }
  if (loading) return <p className="module-note">Cargando formato…</p>;
  if (!loaded) return <p className="module-error" role="alert">{error} Recarga la página para intentarlo de nuevo.</p>;
  return <div className="space-y-5">
    <div className="module-note"><strong>Formato de las cotizaciones</strong><p>Personaliza el documento y revisa el resultado antes de guardar. Las cotizaciones ya emitidas conservan su formato. La firma siempre mostrará el nombre de quien cotizó, sin su cargo.</p></div>
    {error && <p className="module-error" role="alert">{error}</p>}{message && <p className="module-note" role="status">{message}</p>}
    <form onSubmit={save} className="rounded-2xl border border-line bg-surface p-5 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">{fields.map(([key,label,max]) => <label className="text-sm space-y-1" key={key}><span className="block font-semibold">{label}</span>{max > 150 ? <textarea className="w-full rounded-lg border border-line bg-surface p-2" value={String(format[key])} maxLength={max} rows={3} onChange={e => update(key, e.target.value as never)}/> : <input className="w-full rounded-lg border border-line bg-surface p-2" value={String(format[key])} maxLength={max} required={key !== 'despedida'} onChange={e => update(key, e.target.value as never)}/>}</label>)}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Color del texto<input aria-label="Color del texto" type="color" value={format.colorTexto} onChange={e=>update('colorTexto',e.target.value)} className="block w-full h-10"/></label>
        <label className="text-sm">Color de las secciones<input aria-label="Color de las secciones" type="color" value={format.colorSecciones} onChange={e=>update('colorSecciones',e.target.value)} className="block w-full h-10"/></label>
        <label className="text-sm">Tamaño de letra<select className="block w-full rounded-lg border border-line bg-surface p-2" value={format.fuente} onChange={e=>update('fuente',Number(e.target.value))}>{[11,12,13,14,15].map(size=><option key={size} value={size}>{size} px</option>)}</select></label>
        <label className="text-sm">Papel<select className="block w-full rounded-lg border border-line bg-surface p-2" value={format.papel} onChange={e=>update('papel',e.target.value as 'letter' | 'a4')}><option value="letter">Carta</option><option value="a4">A4</option></select></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{(['encabezadoImagen','pieImagen'] as const).map(key=><div key={key} className="border border-line rounded-xl p-3 space-y-2"><label className="block text-sm font-semibold">{key === 'encabezadoImagen' ? 'Imagen del encabezado' : 'Imagen del pie'}<input type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-xs mt-2" onChange={e=>{void upload(key,e.target.files?.[0]);e.target.value='';}}/></label><p className="text-xs text-muted">PNG, JPG o WebP · hasta 500 KB. Recomendado: imagen horizontal. Al quitarla se usará el texto configurado.</p><div className="flex gap-2 flex-wrap"><button type="button" className="theme-toggle" onClick={()=>update(key,'')}>Usar texto</button><button type="button" className="theme-toggle" onClick={()=>update(key,defaultQuoteTemplate[key])}>Imagen original</button></div></div>)}</div>
      <div className="flex flex-wrap gap-3"><button className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Guardar formato'}</button><button type="button" disabled={saving} className="theme-toggle" onClick={()=>{setFormat({...defaultQuoteTemplate});setMessage('Diseño original en la vista previa. Guarda para aplicarlo.');}}>Restablecer diseño original</button></div>
    </form>
    <div><h2 className="font-bold mb-3">Vista previa · datos ficticios</h2><div className="quote-letter-frame"><QuoteLetter work={previewWork} quote={{...previewQuote, datosFormularioJson:{carta:{formato:format,cotizadoPorNombre:'Nombre de quien cotiza',alcance:'Provisión e instalación del equipo.\nPrueba de funcionamiento y entrega al cliente.',condiciones:'Condiciones de ejemplo acordadas con el cliente.'}}}}/></div></div>
  </div>;
}
