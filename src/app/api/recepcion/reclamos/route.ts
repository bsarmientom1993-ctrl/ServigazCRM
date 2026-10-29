import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {requireSession,intakeOperators} from '@/lib/auth';
import {withWork} from '@/lib/workflow';
import {apiError,ApiError} from '@/lib/api';
import {objectRecord} from '@/lib/gas-data';
export async function POST(req:NextRequest){try{
 const user=await requireSession(req,intakeOperators),key=z.string().uuid().parse(req.headers.get('Idempotency-Key'));
 const body=z.object({trabajoId:z.string().min(1),descripcionFalla:z.string().trim().min(10).max(2000)}).strict().parse(await req.json());
 const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const result=await withWork(body.trabajoId,user,async(tx,actor)=>{
 const previous=await tx.reclamoGarantia.findUnique({where:{id:key}});
 if(previous){const audit=await tx.auditoriaLog.findFirst({where:{entidadId:key,modulo:'RECEPCION_RECLAMOS',usuarioId:user.id}});if(previous.trabajoOriginalId!==body.trabajoId||objectRecord(audit?.valoresNuevos).solicitudHash!==fingerprint)throw new ApiError(409,'La solicitud corresponde a otro reclamo.');return{id:previous.id,estado:previous.estado};}
 const claim=await tx.reclamoGarantia.create({data:{id:key,trabajoOriginalId:body.trabajoId,descripcionFalla:body.descripcionFalla,slaLimiteFecha:new Date(Date.now()+24*3600000),estado:'PENDIENTE'}});
 await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'RECEPCION_RECLAMOS',accion:'CREATE',entidadTipo:'ReclamoGarantia',entidadId:key,valoresNuevos:{trabajoId:body.trabajoId,realizadoPor:actor.nombre,solicitudHash:fingerprint,evento:'Solicitud de garantía pendiente de evaluación'}}});
 return{id:claim.id,estado:claim.estado};
 });return NextResponse.json(result,{status:201});
}catch(e){return apiError(e);}}
