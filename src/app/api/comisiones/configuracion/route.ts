import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {commissionConfigSchema} from '@/lib/commission-policy';
export async function PATCH(req:NextRequest){try{
 const user=await requireSession(req,['ADMIN']),input=commissionConfigSchema.parse(await req.json());
 const saved=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'comision-persona:'+input.usuarioId},0))`;
 if(!await tx.usuario.findUnique({where:{id:input.usuarioId},select:{id:true}}))throw new ApiError(404,'Trabajador no encontrado.');
 const actor=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
 const prior=await tx.configuracionComision.findUnique({where:{usuarioId:input.usuarioId}});
 const values={porcentaje:input.porcentaje.toFixed(2),activa:input.activa,modificadoPorId:user.id,modificadoPorNombre:actor.nombre};
 const result=await tx.configuracionComision.upsert({where:{usuarioId:input.usuarioId},create:{usuarioId:input.usuarioId,...values},update:values});
 await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'COMISIONES_CONFIGURACION',accion:prior?'UPDATE':'CREATE',entidadTipo:'ConfiguracionComision',entidadId:input.usuarioId,valoresAnteriores:{porcentaje:prior?String(prior.porcentaje):'0',activa:prior?.activa||false},valoresNuevos:{porcentaje:input.porcentaje,activa:input.activa,realizadoPor:actor.nombre}}});
 return result;
 });return NextResponse.json(saved);
}catch(e){return apiError(e);}}
