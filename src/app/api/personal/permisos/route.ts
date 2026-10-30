import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {requireSession,assignedRoleWhere} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {boundedJson} from '@/lib/professional-policy';
import {boliviaDay,dateSchema,dateValue,localTime} from '@/lib/personnel-policy';
import {personnelLock,editablePeriod,laborConfig} from '@/lib/personnel';
import {queueNotice} from '@/lib/notifications';
export async function POST(req:NextRequest){try{
 const actor=await requireSession(req),body=z.discriminatedUnion('accion',[
  z.object({accion:z.literal('SOLICITAR'),id:z.string().uuid(),fecha:dateSchema,motivo:z.string().trim().min(3).max(100),descripcion:z.string().trim().min(10).max(2000),comprobanteUrl:z.string().max(1500).default('').refine(v=>!v||/^https:\/\//.test(v),'Usa un enlace HTTPS.'),solicitaGoceHaberes:z.boolean()}).strict(),
  z.object({accion:z.literal('DECIDIR'),id:z.string().uuid(),aprobar:z.boolean(),goceHaberes:z.boolean(),motivo:z.string().trim().min(10).max(1500)}).strict(),
  z.object({accion:z.literal('RETIRAR'),id:z.string().uuid()}).strict(),
  z.object({accion:z.literal('REVOCAR'),id:z.string().uuid(),motivo:z.string().trim().min(10).max(1500)}).strict(),
 ]).parse(await boundedJson(req));
 if(['DECIDIR','REVOCAR'].includes(body.accion)&&actor.rol!=='ADMIN')throw new ApiError(403,'Solo el administrador puede resolver permisos.');
 const result=await prisma.$transaction(async tx=>{
  const request=body.accion==='SOLICITAR'?null:await tx.permisoPersonal.findUnique({where:{id:body.id}});if(body.accion!=='SOLICITAR'&&!request)throw new ApiError(404,'Permiso no encontrado.');const target=request?.usuarioId||actor.id;await personnelLock(tx,target);
  const name=await tx.usuario.findUniqueOrThrow({where:{id:actor.id},select:{nombre:true}});
  if(body.accion==='SOLICITAR'){
   const existing=await tx.permisoPersonal.findUnique({where:{id:body.id}});if(existing){if(existing.usuarioId===actor.id&&existing.fechaPermiso.toISOString().slice(0,10)===body.fecha&&existing.descripcion===body.descripcion&&existing.motivo===body.motivo&&existing.comprobanteUrl===body.comprobanteUrl)return{success:true};throw new ApiError(409,'La solicitud ya se utilizó para otro permiso.');}
   const today=boliviaDay();if(body.fecha<today||dateValue(body.fecha).getTime()-dateValue(today).getTime()>366*86400000)throw new ApiError(400,'Solicita un día desde hoy y dentro del próximo año.');await editablePeriod(tx,target,body.fecha.slice(0,7));
   const config=await laborConfig(tx,target,body.fecha.slice(0,7));if(!config?.activo||body.fecha<config.fechaIngreso.toISOString().slice(0,10)||config.fechaBaja&&body.fecha>config.fechaBaja.toISOString().slice(0,10))throw new ApiError(409,'El administrador debe habilitar tu configuración laboral para esa fecha.');
   if(await tx.permisoPersonal.count({where:{usuarioId:target,fechaPermiso:dateValue(body.fecha),estado:{in:['SOLICITADO','APROBADO']}}}))throw new ApiError(409,'Ya tienes un permiso solicitado o aprobado para ese día.');
   if(await tx.asistenciaPersonal.count({where:{usuarioId:target,fecha:dateValue(body.fecha),horaEntrada:{not:null}}}))throw new ApiError(409,'Ya registraste asistencia ese día. Solicita una revisión de la marcación.');
   await tx.permisoPersonal.create({data:{id:body.id,usuarioId:target,fechaPermiso:dateValue(body.fecha),motivo:body.motivo,descripcion:body.descripcion,comprobanteUrl:body.comprobanteUrl}});await tx.gestionPermiso.create({data:{permisoId:body.id,goceHaberes:body.solicitaGoceHaberes}});
   const admins=await tx.usuario.findMany({where:{estado:'ACTIVO',...assignedRoleWhere('ADMIN')},select:{id:true}});await queueNotice(tx,admins.map(a=>'personal:'+a.id),'permiso-solicitado:'+body.id,'PERSONAL','Permiso de personal pendiente','Hay una solicitud de permiso para revisar.','/personal');
  }else{
   const current=await tx.permisoPersonal.findUniqueOrThrow({where:{id:body.id}});const day=current.fechaPermiso.toISOString().slice(0,10);await editablePeriod(tx,target,day.slice(0,7));
   if(body.accion==='RETIRAR'&&target!==actor.id)throw new ApiError(403,'Solo puedes retirar tu propia solicitud.');
   if(body.accion==='REVOCAR'?current.estado!=='APROBADO':current.estado!=='SOLICITADO')throw new ApiError(409,'La solicitud ya tiene una resolución.');
   if(body.accion!=='RETIRAR'&&target===actor.id)throw new ApiError(403,'Otro administrador debe resolver tu propio permiso.');
   if(body.accion==='DECIDIR'&&body.aprobar){
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${target} FOR UPDATE`;
    if(await tx.asistenciaPersonal.count({where:{usuarioId:target,fecha:current.fechaPermiso,horaEntrada:{not:null}}}))throw new ApiError(409,'Ya hay asistencia registrada. Resuelve una solicitud de revisión de ese día.');
    const start=localTime(day,'00:00');if(await tx.visitaTecnica.count({where:{tecnicoId:target,completada:false,fechaProgramada:{gte:start,lt:new Date(start.getTime()+86400000)}}}))throw new ApiError(409,'Reasigna o reprograma las visitas de ese día antes de aprobar el permiso.');
   }
   await tx.permisoPersonal.update({where:{id:body.id},data:{estado:body.accion==='DECIDIR'&&body.aprobar?'APROBADO':'RECHAZADO',aprobadoPorId:body.accion!=='RETIRAR'?actor.id:null}});
   const update=body.accion==='DECIDIR'?{goceHaberes:body.goceHaberes,motivoDecision:body.motivo,decididoPorNombre:name.nombre,retirado:false}:body.accion==='REVOCAR'?{motivoDecision:body.motivo,decididoPorNombre:name.nombre,retirado:false}:{motivoDecision:'Retirado por el solicitante.',decididoPorNombre:name.nombre,retirado:true};
   await tx.gestionPermiso.upsert({where:{permisoId:body.id},create:{permisoId:body.id,...update},update});
   if(body.accion!=='RETIRAR')await queueNotice(tx,['personal:'+target],'permiso-decision:'+body.id,'PERSONAL','Novedades de tu permiso','El administrador resolvió una solicitud de permiso. Revisa su detalle.','/personal');
  }
  await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'PERMISOS_PERSONAL',accion:body.accion==='SOLICITAR'?'CREATE':'UPDATE',entidadTipo:'PermisoPersonal',entidadId:body.id,valoresNuevos:{accion:body.accion,usuarioId:target,realizadoPor:name.nombre,...(body.accion==='DECIDIR'?{aprobar:body.aprobar,goceHaberes:body.goceHaberes,motivo:body.motivo}:body.accion==='REVOCAR'?{motivo:body.motivo}:{})}}});return{success:true};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}
