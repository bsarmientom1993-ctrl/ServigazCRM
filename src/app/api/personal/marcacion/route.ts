import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {boundedJson} from '@/lib/professional-policy';
import {boliviaDay,dateValue,locationSchema,validateLocation,lateMinutes} from '@/lib/personnel-policy';
import {attendanceBranch,personnelLock,editablePeriod,clockToken,verifyClockToken} from '@/lib/personnel';
export async function POST(req:NextRequest){try{
 const user=await requireSession(req),base=z.object({accion:z.enum(['PREPARAR','MARCAR']),sucursalId:z.string().trim().min(1).max(100),tipo:z.enum(['ENTRADA','SALIDA'])}),raw=await boundedJson(req),kind=base.parse(raw),day=boliviaDay();
 if(kind.accion==='PREPARAR'){
  base.strict().parse(raw);await prisma.$transaction(async tx=>{await attendanceBranch(tx,user.id,kind.sucursalId,day);await editablePeriod(tx,user.id,day.slice(0,7));});return NextResponse.json({token:clockToken(user.id,kind.sucursalId,kind.tipo),radioMetros:10},{headers:{'Cache-Control':'private, no-store'}});
 }
 const body=base.extend({accion:z.literal('MARCAR'),token:z.string().min(20).max(2000),ubicacion:locationSchema}).strict().parse(raw),key=z.string().uuid().parse(req.headers.get('Idempotency-Key'));
 const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const result=await prisma.$transaction(async tx=>{
  await personnelLock(tx,user.id);const prior=await tx.marcacionPersonal.findUnique({where:{id:key}});if(prior){if(prior.usuarioId!==user.id||prior.solicitudHash!==fingerprint)throw new ApiError(409,'La clave corresponde a otra marcación.');return{success:true,tipo:prior.tipo,registradoAt:prior.registradoAt};}
  const issued=verifyClockToken(body.token,user.id,body.sucursalId,body.tipo),now=new Date(),today=boliviaDay(now);if(day!==today)throw new ApiError(409,'Cambió el día. Vuelve a iniciar la marcación.');
  await editablePeriod(tx,user.id,today.slice(0,7));const {config,center}=await attendanceBranch(tx,user.id,body.sucursalId,today);const distance=validateLocation(body.ubicacion,center,issued,now);
  if(await tx.permisoPersonal.count({where:{usuarioId:user.id,fechaPermiso:dateValue(today),estado:'APROBADO'}}))throw new ApiError(409,'Tienes un permiso aprobado para todo el día. Coordina su revisión antes de marcar.');
  const existing=await tx.asistenciaPersonal.findUnique({where:{usuarioId_fecha:{usuarioId:user.id,fecha:dateValue(today)}}});
  if(body.tipo==='ENTRADA'&&existing?.horaEntrada||body.tipo==='SALIDA'&&existing?.horaSalida)throw new ApiError(409,'Esta marcación ya está registrada. Actualiza tu asistencia.');
  if(body.tipo==='SALIDA'&&!existing?.horaEntrada)throw new ApiError(409,'Primero debes registrar tu entrada.');
  if(body.tipo==='SALIDA'){const entry=await tx.marcacionPersonal.findUnique({where:{asistenciaId_tipo:{asistenciaId:existing!.id,tipo:'ENTRADA'}}});if(entry&&entry.sucursalId!==body.sucursalId)throw new ApiError(409,'Registra la salida en la misma sucursal de tu entrada.');}
  const weekday=dateValue(today).getUTCDay(),late=body.tipo==='ENTRADA'?lateMinutes(today,now,config.horaEntrada,config.toleranciaMinutos,Array.isArray(config.diasLaborales)&&config.diasLaborales.includes(weekday)):0;
  const attendance=body.tipo==='ENTRADA'?await tx.asistenciaPersonal.upsert({where:{usuarioId_fecha:{usuarioId:user.id,fecha:dateValue(today)}},create:{usuarioId:user.id,fecha:dateValue(today),horaEntrada:now,estado:late?'TARDE':'PRESENTE'},update:{horaEntrada:now,estado:late?'TARDE':'PRESENTE'}}):await tx.asistenciaPersonal.update({where:{id:existing!.id},data:{horaSalida:now}});
  await tx.marcacionPersonal.create({data:{id:key,usuarioId:user.id,asistenciaId:attendance.id,sucursalId:body.sucursalId,tipo:body.tipo,origen:'GPS',latitud:body.ubicacion.latitud,longitud:body.ubicacion.longitud,precisionMetros:body.ubicacion.precisionMetros,distanciaMetros:distance,centroLatitud:Number(center.latitud),centroLongitud:Number(center.longitud),muestraAt:new Date(body.ubicacion.muestraAt),registradoAt:now,minutosTarde:late,solicitudHash:fingerprint}});
  await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'ASISTENCIA',accion:'CREATE',entidadTipo:'MarcacionPersonal',entidadId:key,valoresNuevos:{tipo:body.tipo,asistenciaId:attendance.id,sucursalId:body.sucursalId,origen:'GPS',radioMetros:10,minutosTarde:late}}});return{success:true,tipo:body.tipo,registradoAt:now,minutosTarde:late,distanciaMetros:distance};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}
