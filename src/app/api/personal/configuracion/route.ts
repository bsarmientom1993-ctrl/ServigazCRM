import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {boundedJson} from '@/lib/professional-policy';
import {monthSchema,dateSchema,timeSchema,percentSchema,amountSchema,boliviaDay,dateValue} from '@/lib/personnel-policy';
import {personnelLock,editablePeriod} from '@/lib/personnel';
export async function POST(req:NextRequest){try{
 const actor=await requireSession(req,['ADMIN']),body=z.discriminatedUnion('accion',[
  z.object({accion:z.literal('PUNTO'),sucursalId:z.string().trim().min(1).max(100),latitud:z.number().finite().min(-90).max(90),longitud:z.number().finite().min(-180).max(180),activo:z.boolean(),motivo:z.string().trim().min(10).max(1000)}).strict(),
  z.object({accion:z.literal('REGLAS'),vigenteDesde:monthSchema,inicioControl:dateSchema,divisorDia:z.number().int().min(1).max(31),descuentoFaltaPct:percentSchema,descuentoTardanzaPct:percentSchema,diasNoLaborables:z.array(dateSchema).max(366),activa:z.boolean(),motivo:z.string().trim().min(10).max(1000)}).strict(),
  z.object({accion:z.literal('LABORAL'),usuarioId:z.string().trim().min(1).max(100),vigenteDesde:monthSchema,sueldoMensual:amountSchema,fechaIngreso:dateSchema,fechaBaja:dateSchema.nullable(),horaEntrada:timeSchema,horaSalida:timeSchema,toleranciaMinutos:z.number().int().min(0).max(120),diasLaborales:z.array(z.number().int().min(0).max(6)).min(1).max(7),sucursalesAutorizadas:z.array(z.string().trim().min(1).max(100)).min(1).max(100),activo:z.boolean(),motivo:z.string().trim().min(10).max(1000)}).strict(),
 ]).parse(await boundedJson(req));
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742396)`;const editor=await tx.usuario.findUniqueOrThrow({where:{id:actor.id},select:{nombre:true}});let saved:unknown,id='';
  if(body.accion==='PUNTO'){
   if(!await tx.sucursal.findFirst({where:{id:body.sucursalId,activo:true},select:{id:true}}))throw new ApiError(400,'Selecciona una sucursal activa.');
   const {accion,motivo,...data}=body;const update={latitud:data.latitud,longitud:data.longitud,activo:data.activo,modificadoPorNombre:editor.nombre};saved=await tx.puntoAsistencia.upsert({where:{sucursalId:data.sucursalId},create:{sucursalId:data.sucursalId,...update},update});id=data.sucursalId;
  }else{
   const today=boliviaDay();if(body.vigenteDesde<today.slice(0,7))throw new ApiError(400,'Configura cambios desde el mes actual o un mes futuro. Las liquidaciones anteriores se conservan.');
   if(body.accion==='REGLAS'){
    if(await tx.liquidacionPersonal.count({where:{estado:'CERRADA',periodo:{gte:body.vigenteDesde}}}))throw new ApiError(409,'Hay liquidaciones cerradas que usan estas reglas. Define una vigencia posterior.');
    const previous=await tx.reglaNomina.findUnique({where:{vigenteDesde:body.vigenteDesde}});
    const inherited=previous?null:await tx.reglaNomina.findFirst({where:{vigenteDesde:{lt:body.vigenteDesde}},orderBy:{vigenteDesde:'desc'}});
    if(!previous&&body.inicioControl<today&&body.inicioControl!==inherited?.inicioControl.toISOString().slice(0,10))throw new ApiError(400,'El inicio del control de faltas debe ser hoy o una fecha futura.');
    if(previous&&body.inicioControl!==previous.inicioControl.toISOString().slice(0,10))throw new ApiError(409,'El inicio del control ya registrado se conserva para evitar faltas retroactivas.');
    const {accion,motivo,inicioControl,...rest}=body;const values={...rest,inicioControl:dateValue(inicioControl),modificadoPorNombre:editor.nombre};saved=await tx.reglaNomina.upsert({where:{vigenteDesde:body.vigenteDesde},create:values,update:values});id=body.vigenteDesde;
   }else{
    await personnelLock(tx,body.usuarioId);await editablePeriod(tx,body.usuarioId,body.vigenteDesde);
    if(await tx.liquidacionPersonal.count({where:{usuarioId:body.usuarioId,estado:'CERRADA',periodo:{gte:body.vigenteDesde}}}))throw new ApiError(409,'La configuración afecta una liquidación cerrada. Usa una vigencia posterior.');
    if(!await tx.usuario.findUnique({where:{id:body.usuarioId},select:{id:true}}))throw new ApiError(404,'Persona no encontrada.');
    if(body.horaSalida<=body.horaEntrada)throw new ApiError(400,'La salida debe ser posterior a la entrada dentro del mismo día.');
    if(body.fechaBaja&&body.fechaBaja<body.fechaIngreso)throw new ApiError(400,'La baja no puede ser anterior al ingreso.');
    if(new Set(body.diasLaborales).size!==body.diasLaborales.length||new Set(body.sucursalesAutorizadas).size!==body.sucursalesAutorizadas.length)throw new ApiError(400,'No repitas días ni sucursales.');
    if(await tx.sucursal.count({where:{id:{in:body.sucursalesAutorizadas},activo:true}})!==body.sucursalesAutorizadas.length)throw new ApiError(400,'Selecciona sucursales activas.');
    const {accion,motivo,fechaIngreso,fechaBaja,...rest}=body;const values={...rest,fechaIngreso:dateValue(fechaIngreso),fechaBaja:fechaBaja?dateValue(fechaBaja):null,modificadoPorNombre:editor.nombre};saved=await tx.configuracionLaboral.upsert({where:{usuarioId_vigenteDesde:{usuarioId:body.usuarioId,vigenteDesde:body.vigenteDesde}},create:values,update:values});id=body.usuarioId;
   }
  }
  await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'PERSONAL_CONFIGURACION',accion:'UPDATE',entidadTipo:body.accion,entidadId:id,valoresNuevos:{...body,realizadoPor:editor.nombre}}});return saved;
 },{timeout:15000});return NextResponse.json({success:true,configuracion:result});
}catch(e){return apiError(e);}}
