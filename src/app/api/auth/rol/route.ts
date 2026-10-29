import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { apiError, ApiError } from '@/lib/api';
import { availableRoles, rolesOf } from '@/lib/user-roles';
export async function POST(req:NextRequest){try{
  const session=await requireSession(req);const {rol}=z.object({rol:z.enum(availableRoles)}).strict().parse(await req.json());
  const user=await prisma.usuario.findUniqueOrThrow({where:{id:session.id}});
  if(user.estado!=='ACTIVO'||!rolesOf(user).includes(rol))throw new ApiError(403,'El administrador no te ha asignado ese rol.');
  await prisma.auditoriaLog.create({data:{usuarioId:user.id,modulo:'AUTENTICACION',accion:'UPDATE',entidadTipo:'Usuario',entidadId:user.id,valoresNuevos:{accion:'CAMBIAR_ROL_ACTIVO',rol,realizadoPor:user.nombre}}});
  const response=NextResponse.json({success:true,rol});response.cookies.set('servigaz_rol',rol,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:7*86400});return response;
}catch(e){return apiError(e);}}
