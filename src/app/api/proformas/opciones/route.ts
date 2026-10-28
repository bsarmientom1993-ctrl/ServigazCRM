import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, workScope, inventoryOperators } from '@/lib/auth';
import { apiError, ApiError } from '@/lib/api';
import { locationScope, locationForOperation } from '@/lib/inventory';
import { z } from 'zod';
import { isIndependentProject } from '@/lib/work-responsibility-data';
export async function GET(req:NextRequest){try{
  const user=await requireSession(req);const technical=user.rol==='TECNICO_FIJO';
  const ubicaciones=await prisma.ubicacionInventario.findMany({where:{AND:[locationScope(user),{activo:true,esInicial:false}]},select:{id:true,nombre:true,sucursalId:true},orderBy:{nombre:'asc'}});
  const branches=ubicaciones.map(l=>l.sucursalId).filter((id):id is string=>!!id);
  const clientes=technical?[]:await prisma.cliente.findMany({where:user.rol==='ADMIN'?{}:{sucursalId:{in:branches}},select:{id:true,nombreCompleto:true,sucursalId:true},orderBy:{nombreCompleto:'asc'}});
  const trabajos=await prisma.trabajo.findMany({where:{AND:[user.rol==='ENCARGADO_TIENDA'?{sucursalId:{in:branches}}:workScope(user),{tecnicoId:{not:null},estado:{notIn:['CANCELADO','RECHAZADO','ARCHIVADO','FINALIZADO_FINANCIERO','TERMINADO_TECNICO','VALIDADO']}}]},select:{fechasSla:true,id:true,codigoCorrelativo:true,subtipoNombre:true,sucursalId:true,tecnicoId:true,tecnico:{select:{nombre:true}},cliente:{select:{nombreCompleto:true}}},orderBy:{createdAt:'desc'},take:300});
  const productos=await prisma.productoInventario.findMany({where:{activo:true},select:{id:true,nombre:true,unidadMedida:true,...(!technical?{precioVenta:true}:{})},orderBy:{nombre:'asc'}});
  return NextResponse.json({ubicaciones,clientes,trabajos:trabajos.filter(w=>!isIndependentProject(w)).map(({fechasSla,...w})=>w),productos});
}catch(e){return apiError(e);}}

export async function POST(req:NextRequest){try{
  const user=await requireSession(req,inventoryOperators);
  const input=z.object({id:z.string().uuid(),ubicacionId:z.string().min(1),nombreCompleto:z.string().trim().min(3).max(150),telefono:z.string().trim().regex(/^[+\d\s().-]{6,40}$/,'Revisa el teléfono.'),direccion:z.string().trim().min(3).max(500)}).strict().parse(await req.json());
  const result=await prisma.$transaction(async tx=>{
    const location=await locationForOperation(tx,user,input.ubicacionId);
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.id},0))`;
    const prior=await tx.cliente.findUnique({where:{id:input.id}});
    if(prior){if(prior.nombreCompleto!==input.nombreCompleto||prior.sucursalId!==location.sucursalId||prior.direccion!==input.direccion||JSON.stringify(prior.telefonos)!==JSON.stringify([input.telefono]))throw new ApiError(409,'La clave del cliente ya se usó con otros datos.');return {id:prior.id,nombreCompleto:prior.nombreCompleto,sucursalId:prior.sucursalId};}
    const client=await tx.cliente.create({data:{id:input.id,nombreCompleto:input.nombreCompleto,telefonos:[input.telefono],direccion:input.direccion,sucursalId:location.sucursalId}});
    await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'CLIENTES',accion:'CREATE',entidadTipo:'Cliente',entidadId:client.id,valoresNuevos:{origen:'PROFORMA',nombreCompleto:client.nombreCompleto}}});
    return {id:client.id,nombreCompleto:client.nombreCompleto,sucursalId:client.sucursalId};
  });return NextResponse.json(result);
}catch(e){return apiError(e);}}
