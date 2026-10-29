import {NextRequest,NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {requireSession,workScope} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {apiError,ApiError} from '@/lib/api';
import {withWork} from '@/lib/workflow';
import {technicalWorkSelect,technicalSchedule} from '@/lib/technical-work';
import {objectRecord} from '@/lib/gas-data';
import {evaluationFingerprint} from '@/lib/gas-policy';
const reviewers=['ADMIN','ENCARGADO','SUPERVISOR'] as const;
export async function GET(req:NextRequest){try{
 const user=await requireSession(req,[...reviewers]);const rows=await prisma.trabajo.findMany({where:{AND:[workScope(user),{estado:{notIn:['CANCELADO','ARCHIVADO','RECHAZADO','FINALIZADO_FINANCIERO']}}]},select:technicalWorkSelect,orderBy:{updatedAt:'desc'},take:300});
 return NextResponse.json({trabajos:rows.map(w=>{const review=objectRecord(objectRecord(objectRecord(w.fechasSla).gas).revisionTecnica);return {...w,fechasSla:technicalSchedule(w.fechasSla),revisionTecnica:review.estado?{estado:review.estado,criterio:review.criterio,supervisorNombre:review.supervisorNombre,fecha:review.fecha,visitaId:review.visitaId}:null};})});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{
 const user=await requireSession(req,[...reviewers]);const input=z.object({trabajoId:z.string().min(1),visitaId:z.string().min(1),decision:z.enum(['APROBAR','CORREGIR']),criterio:z.string().trim().min(10).max(3000)}).strict().parse(await req.json());
 const result=await withWork(input.trabajoId,user,async(tx,actor)=>{
  const w=await tx.trabajo.findUniqueOrThrow({where:{id:input.trabajoId},include:{egreso:true,pagos:true,cotizaciones:{orderBy:{numeroVersion:'desc'},take:1}}});
  if(w.egreso||w.pagos.length||w.cotizaciones[0]?.estado==='APROBADA'||!['EVALUADO','COTIZADO','COTIZACION_VENCIDA','EN_NEGOCIACION'].includes(w.estado))throw new ApiError(409,'La revisión de mediciones se registra después de evaluar y antes de aceptar o cobrar.');
  const visit=await tx.visitaTecnica.findFirst({where:{trabajoId:w.id,completada:true},orderBy:[{fechaEjecutada:'desc'},{createdAt:'desc'}]});
  if(!visit||visit.id!==input.visitaId)throw new ApiError(409,'Revisa la evaluación más reciente.');if(visit.tecnicoId===user.id)throw new ApiError(403,'Una persona distinta debe dar el visto bueno a la medición.');
  const metadata=objectRecord(w.fechasSla),gas=objectRecord(metadata.gas);
  const review={estado:input.decision==='APROBAR'?'APROBADO':'CORRECCION_SOLICITADA',visitaId:visit.id,huella:evaluationFingerprint(visit),supervisorId:user.id,supervisorNombre:actor.nombre,fecha:new Date().toISOString(),criterio:input.criterio};gas.revisionTecnica=review;
  if(input.decision==='CORREGIR'){await tx.visitaTecnica.update({where:{id:visit.id},data:{completada:false}});delete gas.calculo;if(gas.supervision)gas.supervision={...gas.supervision,estado:'PENDIENTE'};await tx.cotizacion.updateMany({where:{trabajoId:w.id,estado:'VIGENTE'},data:{estado:'SUPERADA'}});}
  await tx.trabajo.update({where:{id:w.id},data:{fechasSla:JSON.parse(JSON.stringify({...metadata,gas})),...(input.decision==='CORREGIR'?{estado:'EVALUACION_PENDIENTE'}:{})}});
  await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'SUPERVISION_TECNICA',accion:'CREATE',entidadTipo:'Trabajo',entidadId:w.id,valoresNuevos:review as Prisma.InputJsonValue}});return {success:true,revisionTecnica:review};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}
