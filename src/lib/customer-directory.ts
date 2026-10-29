export const completedCustomerWorkStates=['FINALIZADO_FINANCIERO','ARCHIVADO','CANCELADO','RECHAZADO'];
export const customerWorkLabels:Record<string,string>={BORRADOR:'Por coordinar',EVALUACION_PENDIENTE:'Evaluación pendiente',EVALUADO:'Por cotizar',COTIZADO:'Propuesta pendiente',COTIZACION_VENCIDA:'Cotización vencida',EN_NEGOCIACION:'En negociación',APROBADO:'Aceptado',PAGO_A_CUENTA_RECIBIDO:'Pago a cuenta recibido',PAGO_A_CUENTA_VENCIDO:'Pago pendiente',ANTICIPO_RECIBIDO:'Anticipo recibido',EN_PROCESO:'En ejecución',EN_PAUSA:'En pausa',TERMINADO_TECNICO:'Pendiente de revisión de calidad',VALIDADO:'Pendiente de cierre',FINALIZADO_FINANCIERO:'Finalizado',ARCHIVADO:'Archivado',CANCELADO:'Cancelado',RECHAZADO:'Rechazado',RECLAMO_GARANTIA:'Atención por garantía'};
export function customerSearchText(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function phone(s:string){return s.replace(/\D/g,'').replace(/^591(?=\d{8}$)/,'');}
type CustomerRecord={id:string;nombreCompleto:string;telefonos:unknown;email?:string|null;createdAt?:Date|string};
/** Visual grouping only. Keep every source ID; never merge people by name alone. */
export function groupCustomerRecords<T extends CustomerRecord>(records:T[]){
 const sorted=[...records].sort((a,b)=>new Date(a.createdAt||0).getTime()-new Date(b.createdAt||0).getTime()||a.id.localeCompare(b.id));
 const parent=sorted.map((_,i)=>i),keys=new Map<string,number>();
 function root(i:number):number{return parent[i]===i?i:parent[i]=root(parent[i]);}
 sorted.forEach((c,i)=>{const name=customerSearchText(c.nombreCompleto);const contacts=[...(Array.isArray(c.telefonos)?c.telefonos:[]).filter((p):p is string=>typeof p==='string').map(p=>'tel:'+phone(p)).filter(p=>p.length>=11),...(c.email?.trim()?['email:'+c.email.trim().toLowerCase()]:[])];for(const contact of contacts){const key=name+'|'+contact,prior=keys.get(key);if(prior!==undefined)parent[root(i)]=root(prior);else keys.set(key,i);}});
 const groups=new Map<number,T[]>();sorted.forEach((c,i)=>{const r=root(i);groups.set(r,[...(groups.get(r)||[]),c]);});
 return [...groups.values()].map(members=>{const seen=new Set<string>();const telefonos=members.flatMap(m=>Array.isArray(m.telefonos)?m.telefonos.filter((p):p is string=>typeof p==='string'):[]).filter(p=>{const key=phone(p);if(seen.has(key))return false;seen.add(key);return true;});return {...members[0],telefonos,registrosIds:members.map(m=>m.id)};}).sort((a,b)=>a.nombreCompleto.localeCompare(b.nombreCompleto,'es'));
}
