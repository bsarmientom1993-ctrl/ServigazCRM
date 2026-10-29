import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from './api';
import { Session, assertWorkAccess } from './auth';
import { locationScope } from './inventory';
import { isIndependentProject } from './work-responsibility';
import type { QuoteTemplate } from './quote-template';

export const lineInput = z.object({ productoId: z.string().min(1), cantidad: z.number().finite().positive(), precio: z.number().finite().nonnegative().optional() });
export const documentInput = z.object({
  id: z.string().uuid(), tipo: z.enum(['CLIENTE','MATERIALES']), ubicacionId: z.string().min(1),
  clienteId: z.string().optional(), trabajoId: z.string().optional(), tecnicoId: z.string().optional(),
  validoHasta: z.string().datetime({offset:true}), observaciones: z.string().trim().max(3000).default(''),
  condiciones: z.string().trim().max(3000).default(''), items: z.array(lineInput).min(1).max(50),
}).strict();
export type DocumentData = {
  autor: string; huella?: string; formato?:QuoteTemplate; cliente?: string; tecnico?: string; trabajo?: string; ubicacion: string;
  observaciones: string; condiciones: string; total?: string;
  items: {productoId:string; descripcion:string; unidad:string; cantidad:string; precio?:string; subtotal?:string}[];
};
export async function documentScope(tx: Prisma.TransactionClient, user: Session): Promise<Prisma.DocumentoProformaWhereInput> {
  if(user.rol==='TECNICO_FIJO') return { tipo:'MATERIALES', tecnicoId:user.id };
  const locations=await tx.ubicacionInventario.findMany({where:locationScope(user),select:{id:true}});
  return {ubicacionId:{in:locations.map(l=>l.id)},...(user.rol==='VENTAS'?{tipo:'CLIENTE'}:user.rol==='ALMACENERO'?{tipo:'MATERIALES'}:{})};
}
export async function requireDocument(tx:Prisma.TransactionClient,user:Session,id:string) {
  const doc=await tx.documentoProforma.findFirst({where:{AND:[{id},await documentScope(tx,user)]}});
  if(!doc)throw new ApiError(404,'Documento no encontrado en tu ámbito.');
  return doc;
}
export async function operationalWork(tx:Prisma.TransactionClient,user:Session,id:string,tecnicoId:string,branchId:string|null){
  await tx.$queryRaw`SELECT id FROM "Trabajo" WHERE id=${id} FOR UPDATE`;
  const work=await tx.trabajo.findUnique({where:{id},include:{egreso:true}});
  if(!work)throw new ApiError(404,'Trabajo no encontrado.');
  if(['ENCARGADO_TIENDA','ALMACENERO'].includes(user.rol)){if((user.rol==='ENCARGADO_TIENDA'||branchId)&&work.sucursalId!==branchId)throw new ApiError(403,'Selecciona un trabajo de la sucursal de origen.');}
  else assertWorkAccess(user,work);
  if(work.tecnicoId!==tecnicoId)throw new ApiError(409,'El técnico debe estar asignado al trabajo.');
  if(work.egreso||isIndependentProject(work)||['CANCELADO','RECHAZADO','ARCHIVADO','FINALIZADO_FINANCIERO','TERMINADO_TECNICO','VALIDADO'].includes(work.estado))throw new ApiError(409,'El trabajo no admite nuevas entregas ni consumo de materiales.');
  return work;
}
export function safeDelivery<T extends {items:{costoUnitario:unknown}[]}>(delivery:T,technical:boolean){
  return technical?{...delivery,items:delivery.items.map(({costoUnitario,...line})=>line)}:delivery;
}
