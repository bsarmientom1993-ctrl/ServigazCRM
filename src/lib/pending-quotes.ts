import { Session, workScope } from './auth';
import { prisma } from './prisma';
export const pendingWorkStates = ['EVALUACION_PENDIENTE','EVALUADO','COTIZADO','EN_NEGOCIACION','COTIZACION_VENCIDA'] as const;
export type PendingQuote = { id:string; codigo:string; cliente:string; servicio:string; estadoTrabajo:string; grupo:'POR_COTIZAR'|'ESPERANDO_RESPUESTA'|'VENCIDA'; total:string|null; fechaVencimiento:string|null; fechaSolicitud:string; quoteId:string|null; accion:string };
export function pendingQuote(work:any, now=new Date()):PendingQuote|null {
  if (!pendingWorkStates.includes(work.estado)) return null;
  const quote=work.cotizaciones?.[0];
  if (['COTIZADO','EN_NEGOCIACION','COTIZACION_VENCIDA'].includes(work.estado) && quote && ['APROBADA','RECHAZADA','SUPERADA'].includes(quote.estado)) return null;
  const awaiting=['COTIZADO','EN_NEGOCIACION','COTIZACION_VENCIDA'].includes(work.estado)&&quote;
  const expired=awaiting&&(work.estado==='COTIZACION_VENCIDA'||quote.estado==='VENCIDA'||new Date(quote.fechaVencimiento).getTime()<=now.getTime());
  const grupo=awaiting?(expired?'VENCIDA':'ESPERANDO_RESPUESTA'):'POR_COTIZAR';
  return {id:work.id,codigo:work.codigoCorrelativo,cliente:work.cliente?.nombreCompleto||'Cliente registrado',servicio:work.subtipoNombre,estadoTrabajo:work.estado,grupo,
    total:awaiting?String(quote.totalCotizado):null,fechaVencimiento:awaiting?new Date(quote.fechaVencimiento).toISOString():null,fechaSolicitud:new Date(work.createdAt).toISOString(),quoteId:awaiting?quote.id:null,
    accion:grupo==='VENCIDA'?'Revisar y renovar':grupo==='ESPERANDO_RESPUESTA'?'Dar seguimiento':work.estado==='EVALUACION_PENDIENTE'?'Completar evaluación':'Preparar cotización'};
}
export async function pendingQuotes(user:Session){
  const works=await prisma.trabajo.findMany({where:{AND:[workScope(user),{estado:{in:[...pendingWorkStates]}}]},select:{id:true,codigoCorrelativo:true,subtipoNombre:true,estado:true,createdAt:true,cliente:{select:{nombreCompleto:true}},cotizaciones:{orderBy:{numeroVersion:'desc'},take:1,select:{id:true,estado:true,totalCotizado:true,fechaVencimiento:true}}},orderBy:{createdAt:'asc'}});
  const now=new Date();const items=works.map(work=>pendingQuote(work,now)).filter((item):item is PendingQuote=>Boolean(item));
  const resumen={total:items.length,porCotizar:items.filter(item=>item.grupo==='POR_COTIZAR').length,esperandoRespuesta:items.filter(item=>item.grupo==='ESPERANDO_RESPUESTA').length,vencidas:items.filter(item=>item.grupo==='VENCIDA').length};
  return {items,resumen};
}
