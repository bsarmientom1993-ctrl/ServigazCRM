import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {requireSession,assignedRoleWhere} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {boundedJson} from '@/lib/professional-policy';
import {boliviaDay,dateSchema,timeSchema,dateValue,localTime,lateMinutes} from '@/lib/personnel-policy';
import {personnelLock,editablePeriod,laborConfig} from '@/lib/personnel';
import {queueNotice} from '@/lib/notifications';
export async function POST(req:NextRequest){try{
 const actor=await requireSession(req),body=z.discriminatedUnion('accion',[
  z.object({accion:z.literal('SOLICITAR'),id:z.string().uuid(),fecha:dateSchema,descripcion:z.string().trim().min(10).max(2000)}).strict(),
  z.object({accion:z.literal('RESOLVER'),id:z.string().uuid(),aprobar:z.boolean(),justificaDia:z.boolean(),sucursalId:z.string().trim().min(1).max(100).optional(),horaEntrada:timeSchema.optional(),horaSalida:timeSchema.optional(),motivo:z.string().trim().min(10).max(1500)}).strict(),
 ]).parse(await boundedJson(req));if(body.accion==='RESOLVER'&&actor.rol!=='ADMIN')throw new ApiError(403,'Solo el administrador resuelve las revisiones de asistencia.');
 const result=await prisma.$transaction(async tx=>{
  const prior=await tx.incidenciaPersonal.findUnique({where:{id:body.id}});if(body.accion==='RESOLVER'&&!prior)throw new ApiError(404,'Solicitud no encontrada.');const target=body.accion==='SOLICITAR'?actor.id:prior!.usuarioId;await personnelLock(tx,target);const editor=await tx.usuario.findUniqueOrThrow({where:{id:actor.id},select:{nombre:true}});
  if(body.accion==='SOLICITAR'){
   if(prior){if(prior.usuarioId===actor.id&&prior.descripcion===body.descripcion&&prior.fecha.toISOString().slice(0,10)===body.fecha)return{success:true};throw new ApiError(409,'La solicitud ya se utilizó.');}
   const today=boliviaDay();if(body.fecha>today||dateValue(today).getTime()-dateValue(body.fecha).getTime()>62*86400000)throw new ApiError(400,'Selecciona un día de hoy o de los últimos dos meses.');await editablePeriod(tx,target,body.fecha.slice(0,7));
   if(await tx.incidenciaPersonal.count({where:{usuarioId:target,fecha:dateValue(body.fecha),estado:'PENDIENTE'}}))throw new ApiError(409,'Ya tienes una revisión pendiente de ese día.');
   await tx.incidenciaPersonal.create({data:{id:body.id,usuarioId:target,fecha:dateValue(body.fecha),descripcion:body.descripcion}});const admins=await tx.usuario.findMany({where:{estado:'ACTIVO',...assignedRoleWhere('ADMIN')},select:{id:true}});await queueNotice(tx,admins.map(a=>'personal:'+a.id),'incidencia:'+body.id,'PERSONAL','Revisión de asistencia pendiente','Hay una marcación de personal que requiere revisión.','/personal');
  }else{
   const current=await tx.incidenciaPersonal.findUniqueOrThrow({where:{id:body.id}});if(current.estado!=='PENDIENTE')throw new ApiError(409,'La solicitud ya fue resuelta.');if(target===actor.id)throw new ApiError(403,'Otro administrador debe resolver tu propia revisión.');const day=current.fecha.toISOString().slice(0,10);await editablePeriod(tx,target,day.slice(0,7));
   if(body.aprobar){
    if(!body.justificaDia&&!body.horaEntrada&&!body.horaSalida)throw new ApiError(400,'Indica una hora faltante o justifica el día.');
    const config=await laborConfig(tx,target,day.slice(0,7));if(!config)throw new ApiError(409,'Configura primero la jornada de esta persona.');
    if(body.horaEntrada||body.horaSalida){
     if(await tx.permisoPersonal.count({where:{usuarioId:target,fechaPermiso:current.fecha,estado:'APROBADO'}}))throw new ApiError(409,'Hay un permiso aprobado de día completo. Revisa ese permiso antes de agregar marcaciones.');
     if(!body.sucursalId||!Array.isArray(config.sucursalesAutorizadas)||!config.sucursalesAutorizadas.includes(body.sucursalId))throw new ApiError(400,'Selecciona una sucursal autorizada para esta persona.');
     let attendance=await tx.asistenciaPersonal.findUnique({where:{usuarioId_fecha:{usuarioId:target,fecha:current.fecha}}});if(body.horaEntrada&&attendance?.horaEntrada||body.horaSalida&&attendance?.horaSalida)throw new ApiError(409,'Las horas ya registradas se conservan. Solo puedes completar marcaciones faltantes.');
     const entry=body.horaEntrada?localTime(day,body.horaEntrada):attendance?.horaEntrada,out=body.horaSalida?localTime(day,body.horaSalida):attendance?.horaSalida;if(!entry||out&&out<=entry)throw new ApiError(400,'La salida requiere una entrada anterior.');if(entry>new Date()||out&&out>new Date())throw new ApiError(400,'No registres marcaciones futuras.');
     const late=lateMinutes(day,entry,config.horaEntrada,config.toleranciaMinutos,Array.isArray(config.diasLaborales)&&config.diasLaborales.includes(current.fecha.getUTCDay()));
     attendance=await tx.asistenciaPersonal.upsert({where:{usuarioId_fecha:{usuarioId:target,fecha:current.fecha}},create:{usuarioId:target,fecha:current.fecha,horaEntrada:entry,horaSalida:out||null,estado:late?'TARDE':'PRESENTE'},update:{...(body.horaEntrada?{horaEntrada:entry}:{}),...(body.horaSalida?{horaSalida:out}:{}),estado:late?'TARDE':'PRESENTE'}});
     for(const [type,value]of [['ENTRADA',body.horaEntrada],['SALIDA',body.horaSalida]] as const)if(value)await tx.marcacionPersonal.create({data:{asistenciaId:attendance.id,usuarioId:target,sucursalId:body.sucursalId,tipo:type,origen:'REGULARIZACION',registradoAt:localTime(day,value),minutosTarde:type==='ENTRADA'?late:0,justificacion:body.motivo,solicitudHash:createHash('sha256').update(body.id+type).digest('hex')}});
    }
   }
   await tx.incidenciaPersonal.update({where:{id:body.id},data:{estado:body.aprobar?'APROBADA':'RECHAZADA',justificaDia:body.aprobar&&body.justificaDia,resolucion:body.motivo,resueltoPorNombre:editor.nombre,resueltoAt:new Date()}});await queueNotice(tx,['personal:'+target],'incidencia-decision:'+body.id,'PERSONAL','Novedades de tu asistencia','El administrador resolvió tu solicitud de revisión.','/personal');
  }
  await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'ASISTENCIA_REVISION',accion:body.accion==='SOLICITAR'?'CREATE':'UPDATE',entidadTipo:'IncidenciaPersonal',entidadId:body.id,valoresNuevos:{accion:body.accion,usuarioId:target,realizadoPor:editor.nombre,...(body.accion==='RESOLVER'?{aprobar:body.aprobar,justificaDia:body.justificaDia,motivo:body.motivo}:{})}}});return{success:true};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}
