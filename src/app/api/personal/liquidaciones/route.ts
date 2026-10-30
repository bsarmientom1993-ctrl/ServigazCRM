import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {boundedJson} from '@/lib/professional-policy';
import {monthSchema} from '@/lib/personnel-policy';
import {personnelLock,payrollSummary} from '@/lib/personnel';
import {queueNotice} from '@/lib/notifications';
export async function POST(req:NextRequest){try{
 const actor=await requireSession(req,['ADMIN']),body=z.discriminatedUnion('accion',[
  z.object({accion:z.literal('CERRAR'),usuarioId:z.string().trim().min(1).max(100),periodo:monthSchema,revisado:z.literal(true)}).strict(),
  z.object({accion:z.literal('ANULAR'),id:z.string().uuid(),motivo:z.string().trim().min(10).max(1500)}).strict(),
 ]).parse(await boundedJson(req));
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742396)`;
  const old=body.accion==='ANULAR'?await tx.liquidacionPersonal.findUnique({where:{id:body.id}}):null;if(body.accion==='ANULAR'&&!old)throw new ApiError(404,'Liquidación no encontrada.');const target=body.accion==='CERRAR'?body.usuarioId:old!.usuarioId;await personnelLock(tx,target);const editor=await tx.usuario.findUniqueOrThrow({where:{id:actor.id},select:{nombre:true}});let saved;
  if(body.accion==='CERRAR'){
   const existing=await tx.liquidacionPersonal.findFirst({where:{usuarioId:target,periodo:body.periodo,estado:'CERRADA'}});if(existing)return{success:true,id:existing.id};
   const snapshot=await payrollSummary(tx,target,body.periodo);if(!snapshot.puedeCerrar)throw new ApiError(409,String(snapshot.motivoBloqueo||'Revisa la configuración y las novedades del período.'));
   const last=await tx.liquidacionPersonal.findFirst({where:{usuarioId:target,periodo:body.periodo},orderBy:{version:'desc'},select:{version:true}});
   saved=await tx.liquidacionPersonal.create({data:{usuarioId:target,periodo:body.periodo,version:(last?.version||0)+1,snapshot:JSON.parse(JSON.stringify(snapshot)),totalBruto:String(snapshot.bruto),totalDescuentos:String(snapshot.descuentos),totalNeto:String(snapshot.neto),creadoPorNombre:editor.nombre}});
  }else{
   if(old!.estado==='ANULADA')return{success:true,id:old!.id};saved=await tx.liquidacionPersonal.update({where:{id:old!.id},data:{estado:'ANULADA',motivoAnulacion:body.motivo,anuladaAt:new Date()}});
  }
  await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'NOMINA',accion:body.accion==='CERRAR'?'CREATE':'UPDATE',entidadTipo:'LiquidacionPersonal',entidadId:saved.id,valoresNuevos:{accion:body.accion,usuarioId:target,periodo:saved.periodo,realizadoPor:editor.nombre,...(body.accion==='ANULAR'?{motivo:body.motivo}:{neto:String(saved.totalNeto),descuentos:String(saved.totalDescuentos)})}}});await queueNotice(tx,['personal:'+target],'nomina:'+saved.id+':'+saved.estado,'PERSONAL','Resumen de sueldo actualizado','El administrador actualizó la liquidación de un período. Consulta Mi personal.','/personal');return{success:true,id:saved.id};
 },{timeout:20000});return NextResponse.json(result);
}catch(e){return apiError(e);}}
