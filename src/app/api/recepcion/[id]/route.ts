import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {requireSession,assertWorkAccess,intakeOperators} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {withWork} from '@/lib/workflow';
import {activeTeamMember,commercialOrigin} from '@/lib/work-responsibility';
import {objectRecord} from '@/lib/gas-data';
import {receptionData} from '@/lib/reception';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const user=await requireSession(req,['ADMIN','ENCARGADO','VENTAS','TECNICO_FIJO']),{id}=await params;
 const w=await prisma.trabajo.findUnique({where:{id},select:{id:true,codigoCorrelativo:true,subtipoNombre:true,observaciones:true,estado:true,sucursalId:true,encargadoId:true,tecnicoId:true,fechasSla:true,cliente:{select:{nombreCompleto:true,telefonos:true}},encargado:{select:{nombre:true}},tecnico:{select:{nombre:true}},equiposRecibidos:{orderBy:{createdAt:'asc'}}}});
 if(!w)throw new ApiError(404,'Trabajo no encontrado.');assertWorkAccess(user,w);
 const events=await prisma.auditoriaLog.findMany({where:{OR:[{entidadId:id,modulo:'RECEPCION_SEGUIMIENTO'},{entidadId:{in:w.equiposRecibidos.map(e=>e.id)},modulo:'RECEPCION_EQUIPOS'}]},orderBy:{timestamp:'desc'},take:30,select:{id:true,timestamp:true,accion:true,valoresNuevos:true}});
 const {fechasSla,...safe}=w;
 return NextResponse.json({...safe,recepcion:receptionData(fechasSla),captadoPor:commercialOrigin({fechasSla}),historial:events.map(e=>{const v=objectRecord(e.valoresNuevos);return{id:e.id,fecha:e.timestamp,accion:e.accion,nombre:v.realizadoPor,nota:v.nota||v.observaciones||'',proximoContacto:v.proximoContacto||'',evento:v.evento||''};})},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const user=await requireSession(req,intakeOperators),{id}=await params;
 const input=z.discriminatedUnion('accion',[
 z.object({accion:z.literal('SEGUIMIENTO'),responsableId:z.string().min(1).max(100),proximoContacto:z.string().datetime({offset:true}).nullable(),nota:z.string().trim().min(5).max(2000)}).strict(),
 z.object({accion:z.literal('DEVOLVER_EQUIPO'),equipoId:z.string().uuid(),entregadoA:z.string().trim().min(3).max(150),observaciones:z.string().trim().min(5).max(2000),confirmado:z.literal(true)}).strict(),
 ]).parse(await req.json());
 const result=await withWork(id,user,async(tx,actor)=>{
 const work=await tx.trabajo.findUniqueOrThrow({where:{id}});
 if(input.accion==='SEGUIMIENTO'){
   if(input.proximoContacto&&new Date(input.proximoContacto)<=new Date())throw new ApiError(400,'Selecciona una próxima fecha de contacto futura.');
   const person=await activeTeamMember(tx,user,input.responsableId,work.sucursalId);
   const meta=objectRecord(work.fechasSla),reception=objectRecord(meta.recepcion);
   const seguimiento={responsableId:person.id,responsableNombre:person.nombre,proximoContacto:input.proximoContacto||'',nota:input.nota,actualizado:new Date().toISOString()};
   await tx.trabajo.update({where:{id},data:{fechasSla:{...meta,recepcion:{...reception,seguimiento}}}});
   await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'RECEPCION_SEGUIMIENTO',accion:'UPDATE',entidadTipo:'Trabajo',entidadId:id,valoresNuevos:{...seguimiento,realizadoPor:actor.nombre,evento:'Seguimiento comercial'}}});
   return {success:true};
 }
 const eq=await tx.recepcionEquipo.findUnique({where:{id:input.equipoId}});
 if(!eq||eq.trabajoId!==id)throw new ApiError(404,'Equipo no encontrado en esta recepción.');
 if(eq.devueltoAt)return {success:true,yaDevuelto:true};
 await tx.recepcionEquipo.update({where:{id:eq.id},data:{devueltoAt:new Date(),devueltoPorId:actor.id,devueltoPorNombre:actor.nombre,entregadoA:input.entregadoA,observacionesDevolucion:input.observaciones}});
 await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'RECEPCION_EQUIPOS',accion:'UPDATE',entidadTipo:'RecepcionEquipo',entidadId:eq.id,valoresNuevos:{trabajoId:id,evento:'Equipo devuelto',realizadoPor:actor.nombre,entregadoA:input.entregadoA,observaciones:input.observaciones}}});
 return{success:true};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}
