"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { Camera,FolderOpen,ImagePlus,RefreshCw } from "lucide-react";
import { photoStageLabels,type PhotoStage } from "@/lib/photo-data";
import { agendaZone } from "@/lib/technician-agenda";
type Photo={id:string;url:string;etapa:PhotoStage;descripcion:string;autorNombre:string;createdAt:string};
export type PhotoReferences={initial:string[];final:string[]};
async function preparePhoto(file:File){
  if(file.size>25000000)throw new Error("La foto es muy grande. Selecciona una imagen de menos de 25 MB.");
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});}catch{throw new Error("El dispositivo no pudo abrir esta imagen. Selecciona una foto JPG, PNG o WebP.");}
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");if(!context){bitmap.close();throw new Error("No se pudo preparar la fotografía.");}context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  let quality=.82,blob:Blob|null=null;
  do{blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));quality-=.12;}while(blob&&blob.size>700000&&quality>.3);
  if(!blob||blob.size>2000000)throw new Error("No se pudo reducir la imagen. Selecciona una foto más pequeña.");return blob;
}
export function WorkPhotoFolders({workId,onPhotosChange,initialOnly=false}:{workId:string;onPhotosChange?:(photos:PhotoReferences)=>void;initialOnly?:boolean}){
  const [data,setData]=useState<any>(null),[stage,setStage]=useState<PhotoStage>("INICIAL"),[description,setDescription]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true),[uploading,setUploading]=useState(false),[progress,setProgress]=useState("");
  const busy=useRef(false),keys=useRef(new Map<string,string>()),callback=useRef(onPhotosChange);callback.current=onPhotosChange;
  const load=useCallback(async()=>{const res=await fetch("/api/trabajos/"+workId+"/fotos");const body=await res.json();if(!res.ok)throw new Error(body.error||"No se pudieron cargar las fotos.");setData(body);callback.current?.({initial:body.fotos.filter((p:Photo)=>p.etapa==="INICIAL").map((p:Photo)=>p.url),final:body.fotos.filter((p:Photo)=>p.etapa==="FINAL").map((p:Photo)=>p.url)});},[workId]);
  useEffect(()=>{setLoading(true);setError("");setData(null);load().catch(err=>setError(err.message)).finally(()=>setLoading(false));},[load]);
  async function upload(files:File[]){
    if(busy.current||!files.length)return;busy.current=true;setUploading(true);setError("");let successful=0;
    try{for(const [index,file]of files.entries()){
      setProgress("Preparando foto "+(index+1)+" de "+files.length+"…");const blob=await preparePhoto(file);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()))).map(v=>v.toString(16).padStart(2,"0")).join("");const request=stage+":"+description+":"+hash;
      if(!keys.current.has(request))keys.current.set(request,crypto.randomUUID());const form=new FormData();form.append("etapa",stage);form.append("descripcion",description);form.append("foto",blob,"foto.jpg");
      setProgress("Guardando foto "+(index+1)+" de "+files.length+"…");const res=await fetch("/api/trabajos/"+workId+"/fotos",{method:"POST",headers:{"Idempotency-Key":keys.current.get(request)!},body:form});const body=await res.json();if(!res.ok)throw new Error(body.error||"No se pudo guardar la fotografía.");successful++;}
      setProgress(successful+" foto(s) guardada(s) en "+photoStageLabels[stage]+".");setDescription("");
    }catch(err:any){setError((successful?successful+" foto(s) guardada(s). ":"")+err.message);setProgress("");}
    finally{try{await load();}catch(err:any){setError(err.message);}setUploading(false);busy.current=false;}
  }
  const photos:Photo[]=data?.fotos||[],shown=photos.filter(photo=>photo.etapa===stage);
  return <section id="registro-fotografico" className="module-card space-y-4" aria-busy={uploading}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-lg text-ink flex items-center gap-2"><FolderOpen size={21}/>Carpetas de fotos del trabajo</h3>{data&&<p className="text-xs text-muted mt-1">{data.trabajo.codigo} · {data.trabajo.cliente}</p>}</div><button className="theme-toggle" type="button" disabled={uploading||loading} onClick={()=>{setError("");load().catch(err=>setError(err.message));}}><RefreshCw size={16}/>Actualizar</button></div>
    <div className="grid sm:grid-cols-2 gap-3" aria-label="Carpetas de fotografías">{((initialOnly?["INICIAL"]:["INICIAL","FINAL"]) as PhotoStage[]).map(value=><button className={stage===value?"primary-action !min-h-12":"theme-toggle !min-h-12"} type="button" aria-pressed={stage===value} disabled={uploading} key={value} onClick={()=>{setStage(value);setError("");setProgress("");}}><FolderOpen size={18}/>{photoStageLabels[value]} · {photos.filter(p=>p.etapa===value).length}</button>)}</div>
    <p className="text-sm text-secondary">{stage==="INICIAL"?"Fotos del requerimiento y las condiciones del lugar, tomadas durante la evaluación para preparar la cotización.":"Fotos de cómo quedó el trabajo aceptado. Pueden registrarlas el técnico, otro técnico de la sucursal, el encargado o el administrador."}</p>
    {error&&<p className="module-error" role="alert">{error}</p>}{progress&&<p className="module-note" role="status">{progress}</p>}
    {loading?<p className="text-sm text-muted" role="status">Cargando carpetas…</p>:data&&<>
      {data.permisos[stage]?<fieldset className="space-y-3" disabled={uploading}><label className="form-label block">Descripción de las fotos · opcional<input className="module-input mt-2" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder={stage==="INICIAL"?"Ej.: ubicación solicitada y estado de las conexiones":"Ej.: instalación terminada y prueba realizada"}/></label><div className="grid sm:grid-cols-2 gap-3"><label className="theme-toggle !min-h-12 cursor-pointer"><Camera size={19}/>Tomar foto<input className="sr-only" type="file" accept="image/*" capture="environment" disabled={uploading} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value="";upload(files);}}/></label><label className="theme-toggle !min-h-12 cursor-pointer"><ImagePlus size={19}/>Elegir de la galería<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={uploading} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value="";upload(files);}}/></label></div><p className="text-xs text-muted">Fotos privadas y optimizadas · Hasta 20 por carpeta · Cada registro conserva su autor y fecha.</p></fieldset>:<p className="module-note">{stage==="FINAL"?"La carpeta final se habilita al aceptar la propuesta. Las fotos ya registradas se conservan para consulta.":"Las fotos iniciales las registra el técnico asignado o el encargado antes de la aceptación de la propuesta."}</p>}
      {!shown.length?<p className="text-sm text-muted">Esta carpeta todavía no tiene fotos.</p>:<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{shown.map(photo=><figure key={photo.id} className="space-y-2 min-w-0"><a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={"Abrir foto: "+(photo.descripcion||photoStageLabels[photo.etapa])}><img src={photo.url+"?mini=1"} alt={photo.descripcion||photoStageLabels[photo.etapa]} loading="lazy" className="w-full aspect-[4/3] object-cover rounded-xl border border-line"/></a><figcaption className="space-y-1"><p className="text-sm text-secondary break-words">{photo.descripcion||"Sin descripción"}</p><p className="text-xs text-muted break-words">{photo.autorNombre} · {new Date(photo.createdAt).toLocaleString("es-BO",{timeZone:agendaZone})}</p><a className="inline-flex min-h-11 items-center text-sm underline text-secondary" href={photo.url+"?descargar=1"}>Descargar foto</a></figcaption></figure>)}</div>}
    </>}
  </section>;
}
