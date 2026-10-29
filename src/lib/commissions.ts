import type {Prisma} from '@prisma/client';
import {commercialOrigin} from './work-responsibility-data';
import {commissionCents} from './commission-policy';
import {money} from './workflow-policy';
export async function generateWorkCommission(tx:Prisma.TransactionClient,work:{id:string;codigoCorrelativo:string;subtipoNombre:string;fechasSla?:unknown},profit:number,actor:{id:string;nombre:string}){
 const prior=await tx.comisionTrabajo.findUnique({where:{trabajoId:work.id}});if(prior)return prior;
 const origin=commercialOrigin(work);
 if(origin.id)await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'comision-persona:'+origin.id},0))`;
 const person=origin.id?await tx.usuario.findUnique({where:{id:origin.id},select:{id:true,nombre:true}}):null;
 const config=person?await tx.configuracionComision.findUnique({where:{usuarioId:person.id}}):null;
 const percentage=config?.activa?Number(config.porcentaje):0;
 const amount=commissionCents(profit,percentage);
 const reason=!person?'No se identificó a quien consiguió la venta.':profit<=0?'El cierre no tiene utilidad positiva.':!config?.activa||percentage===0?'Sin porcentaje de comisión activo al cierre.':amount===0?'El importe calculado es inferior a un centavo.':'';
 const row=await tx.comisionTrabajo.create({data:{trabajoId:work.id,codigoTrabajo:work.codigoCorrelativo,servicio:work.subtipoNombre,beneficiarioId:person?.id||null,beneficiarioNombre:person?.nombre||origin.nombre||'Sin identificar',utilidadBase:money(profit),porcentaje:percentage.toFixed(2),monto:money(reason?0:amount),estado:reason?'NO_GENERADA':'PENDIENTE',motivo:reason,generadaPorNombre:actor.nombre}});
 await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'COMISIONES',accion:'CREATE',entidadTipo:'ComisionTrabajo',entidadId:row.id,valoresNuevos:{trabajoId:work.id,beneficiarioId:person?.id||null,beneficiarioNombre:row.beneficiarioNombre,utilidadBase:money(profit),porcentaje:percentage,monto:money(reason?0:amount),estado:row.estado,motivo:reason,realizadoPor:actor.nombre}}});
 return row;
}
