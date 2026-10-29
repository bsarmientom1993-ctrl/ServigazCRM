import { z } from 'zod';
import { prisma } from './prisma';
import { ApiError } from './api';
import type { Session } from './auth';
import { availableRoles, rolesOf } from './user-roles';
export const rolesSchema=z.object({roles:z.array(z.enum(availableRoles)).max(availableRoles.length).refine(r=>new Set(r).size===r.length,'No repitas roles.')}).strict();
export async function updateUserRoles(actor:Session,id:string,input:unknown){
  if(actor.rol!=='ADMIN')throw new ApiError(403,'Solo el administrador puede asignar roles.');
  const {roles}=rolesSchema.parse(input);
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742386)`;
    const administrator=await tx.usuario.findUnique({where:{id:actor.id}});
    if(!administrator||administrator.estado!=='ACTIVO'||!rolesOf(administrator).includes('ADMIN'))throw new ApiError(403,'Tu acceso de administrador cambió.');
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Usuario" WHERE id=${id} FOR UPDATE`;
    if(!rows.length)throw new ApiError(404,'Usuario no encontrado.');
    const before=await tx.usuario.findUniqueOrThrow({where:{id}});const previous=rolesOf(before);
    if(before.estado==='ACTIVO'&&previous.includes('ADMIN')&&!roles.includes('ADMIN')){
      const active=await tx.usuario.findMany({where:{estado:'ACTIVO'},select:{rol:true,rolesAsignados:true}});
      if(active.filter(u=>rolesOf(u).includes('ADMIN')).length<=1)throw new ApiError(409,'Debe quedar al menos un administrador activo. Asigna ese rol a otra persona antes de retirarlo.');
    }
    const primary=roles.includes(before.rol)?before.rol:roles[0]||before.rol;
    const user=await tx.usuario.update({where:{id},data:{rolesAsignados:roles,rol:primary,estado:roles.length?'ACTIVO':'INACTIVO'},select:{id:true,nombre:true,rol:true,rolesAsignados:true,estado:true}});
    await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'USUARIOS',accion:'UPDATE',entidadTipo:'Usuario',entidadId:id,valoresAnteriores:{roles:previous,estado:before.estado},valoresNuevos:{roles,estado:user.estado,realizadoPor:administrator.nombre}}});
    return {id:user.id,nombre:user.nombre,rol:user.rol,roles:rolesOf(user),estado:user.estado};
  },{timeout:15000});
}
