import {hasAssignedRole} from '@/lib/user-roles';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, inventoryOperators, managers } from '@/lib/auth';
import { ApiError, apiError } from '@/lib/api';
import { documentScope, requireDocument, DocumentData, operationalWork, safeDelivery } from '@/lib/proformas';
import { lockLocations, locationForOperation, lockProduct, quantity, takeStock, addStock } from '@/lib/inventory';

export async function GET(req:NextRequest){try{
  const user=await requireSession(req);const result=await prisma.$transaction(async tx=>{
    const id=req.nextUrl.searchParams.get('id');
    const entregas=await tx.entregaMaterial.findMany({where:{proforma:await documentScope(tx,user),...(id?{id}:{})},include:{proforma:true,items:true,operaciones:{orderBy:{createdAt:'asc'}}},orderBy:{createdAt:'desc'},take:id?1:200});
    return entregas.map(e=>safeDelivery(e,user.rol==='TECNICO_FIJO'));
  });return NextResponse.json({entregas:result});
}catch(e){return apiError(e);}}

export async function POST(req:NextRequest){try{
  const user=await requireSession(req,inventoryOperators);const input=z.object({id:z.string().uuid(),proformaId:z.string().uuid(),observaciones:z.string().trim().max(2000).default(''),items:z.array(z.object({productoId:z.string().min(1),cantidad:z.number().finite().positive()})).min(1).max(50)}).parse(await req.json());
  if(new Set(input.items.map(i=>i.productoId)).size!==input.items.length)throw new ApiError(400,'No repitas productos en la entrega.');
  const huella=createHash('sha256').update(user.id+JSON.stringify(input)).digest('hex');
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.id},0))`;
    const previous=await tx.entregaMaterial.findUnique({where:{id:input.id},include:{items:true}});
    if(previous){if(previous.huella!==huella)throw new ApiError(409,'La clave se usó en otra entrega.');await requireDocument(tx,user,previous.proformaId);return previous;}
    // Use the same work -> document -> product lock order as work execution and settlement.
    const candidate=await requireDocument(tx,user,input.proformaId);
    if(candidate.tipo!=='MATERIALES'||!candidate.trabajoId||!candidate.tecnicoId)throw new ApiError(400,'La entrega requiere una solicitud de materiales.');
    const origin=await tx.ubicacionInventario.findUniqueOrThrow({where:{id:candidate.ubicacionId}});
    await operationalWork(tx,user,candidate.trabajoId,candidate.tecnicoId,origin.sucursalId);
    await tx.$queryRaw`SELECT id FROM "DocumentoProforma" WHERE id=${candidate.id} FOR UPDATE`;
    const doc=await requireDocument(tx,user,candidate.id);
    if(doc.estado!=='APROBADA'||doc.validoHasta<new Date())throw new ApiError(409,'La solicitud debe estar aprobada y vigente.');
    await lockLocations(tx,[doc.ubicacionId]);const location=await locationForOperation(tx,user,doc.ubicacionId);
    const tech=await tx.usuario.findUnique({where:{id:doc.tecnicoId!}});if(!tech||tech.estado!=='ACTIVO'||!hasAssignedRole(tech,'TECNICO_FIJO'))throw new ApiError(409,'El técnico no está activo.');
    const requested=(doc.datos as unknown as DocumentData).items;
    const prior=await tx.entregaMaterialItem.findMany({where:{entrega:{proformaId:doc.id}}});
    const author=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
    const delivery=await tx.entregaMaterial.create({data:{id:input.id,proformaId:doc.id,creadoPorId:user.id,creadoPorNombre:author.nombre,huella,observaciones:input.observaciones}});
    for(const line of [...input.items].sort((a,b)=>a.productoId.localeCompare(b.productoId))){
      const specification=requested.find(i=>i.productoId===line.productoId);const amount=quantity(line.cantidad);
      const supplied=prior.filter(i=>i.productoId===line.productoId).reduce((sum,i)=>sum.add(i.cantidad),new Prisma.Decimal(0));
      if(!specification||supplied.add(amount).gt(specification.cantidad))throw new ApiError(409,'La entrega supera la cantidad solicitada.');
      const product=await lockProduct(tx,line.productoId);const balance=await takeStock(tx,product.id,location.id,amount);
      await tx.entregaMaterialItem.create({data:{entregaId:delivery.id,productoId:product.id,descripcion:specification.descripcion,unidad:specification.unidad,cantidad:amount,costoUnitario:product.costoPromedio}});
      // Stock stays company-owned while the technician holds it. Consumption, not issuance, reduces the company total.
      await tx.movimientoInventario.create({data:{productoId:product.id,tipoMovimiento:'TRASPASO',evento:'ENTREGA_TECNICO',cantidad:amount,stockAnterior:balance.before,stockNuevo:balance.after,usuarioId:user.id,ubicacionOrigenId:location.id,origenSucursalId:location.sucursalId,observaciones:'Entrega ENT-'+delivery.numero+' · '+tech.nombre+' · '+(doc.datos as unknown as DocumentData).trabajo}});
    }
    await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'ENTREGAS',accion:'CREATE',entidadTipo:'EntregaMaterial',entidadId:delivery.id,valoresNuevos:{numero:delivery.numero,proformaId:doc.id,realizadoPor:author.nombre}}});
    return tx.entregaMaterial.findUniqueOrThrow({where:{id:delivery.id},include:{items:true}});
  },{timeout:20000});return NextResponse.json(result);
}catch(e){return apiError(e);}}

export async function PATCH(req:NextRequest){try{
  const user=await requireSession(req);const key=z.string().uuid('Falta la clave de operación.').parse(req.headers.get('Idempotency-Key'));
  const input=z.object({id:z.string().uuid(),accion:z.enum(['RECIBIR','CONSUMIR','DEVOLVER']),itemId:z.string().uuid().optional(),cantidad:z.number().finite().positive().optional(),motivo:z.string().trim().max(1000).default('')}).parse(await req.json());
  const fingerprint=createHash('sha256').update(user.id+JSON.stringify(input)).digest('hex');
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key},0))`;
    const previous=await tx.operacionEntrega.findUnique({where:{id:key}});
    if(previous){if(previous.huella!==fingerprint)throw new ApiError(409,'La clave ya se usó en otra operación.');return {success:true,yaRegistrada:true};}
    const candidate=await tx.entregaMaterial.findUnique({where:{id:input.id},include:{proforma:true}});
    if(!candidate)throw new ApiError(404,'Entrega no encontrada.');
    const doc=await requireDocument(tx,user,candidate.proformaId);
    const location=await tx.ubicacionInventario.findUniqueOrThrow({where:{id:doc.ubicacionId}});
    // Returns remain possible after reassignment; only consumption depends on the current assigned job.
    if(input.accion==='CONSUMIR')await operationalWork(tx,user,doc.trabajoId!,doc.tecnicoId!,location.sucursalId);
    await tx.$queryRaw`SELECT id FROM "EntregaMaterial" WHERE id=${input.id} FOR UPDATE`;
    const delivery=await tx.entregaMaterial.findUniqueOrThrow({where:{id:input.id},include:{items:true}});
    if(input.accion==='RECIBIR'){
      if(user.id!==doc.tecnicoId)throw new ApiError(403,'La recepción debe confirmarla el técnico destinatario.');
      if(!delivery.recibidoAt)await tx.entregaMaterial.update({where:{id:delivery.id},data:{recibidoAt:new Date()}});
    }else{
      if(input.accion==='DEVOLVER'&&!inventoryOperators.includes(user.rol))throw new ApiError(403,'La tienda debe comprobar y registrar la devolución física.');
      if(input.accion==='CONSUMIR'&&user.id!==doc.tecnicoId&&!managers.includes(user.rol))throw new ApiError(403,'El técnico asignado o el encargado registra el consumo.');
      if(input.accion==='CONSUMIR'&&!delivery.recibidoAt)throw new ApiError(409,'Confirma la recepción antes de usar los materiales.');
      if(input.accion==='DEVOLVER'&&input.motivo.length<3)throw new ApiError(400,'Indica el motivo de la devolución.');
      if(!input.itemId||!input.cantidad)throw new ApiError(400,'Indica el material y la cantidad.');
      const item=delivery.items.find(i=>i.id===input.itemId);if(!item)throw new ApiError(400,'Material no encontrado en esta entrega.');
      const amount=quantity(input.cantidad);if(amount.gt(item.cantidad.sub(item.consumida).sub(item.devuelta)))throw new ApiError(409,'La cantidad supera el material pendiente.');
      await lockLocations(tx,[location.id]);await lockProduct(tx,item.productoId);
      if(input.accion==='DEVOLVER'){
        await locationForOperation(tx,user,location.id);const balance=await addStock(tx,item.productoId,location.id,amount);
        await tx.entregaMaterialItem.update({where:{id:item.id},data:{devuelta:{increment:amount}}});
        await tx.movimientoInventario.create({data:{productoId:item.productoId,tipoMovimiento:'TRASPASO',evento:'DEVOLUCION_TECNICO',cantidad:amount,stockAnterior:balance.before,stockNuevo:balance.after,usuarioId:user.id,ubicacionDestinoId:location.id,destinoSucursalId:location.sucursalId,observaciones:'ENT-'+delivery.numero+' · '+input.motivo}});
      }else{
        const work=await tx.trabajo.findUniqueOrThrow({where:{id:doc.trabajoId!}});if(work.estado!=='EN_PROCESO')throw new ApiError(409,'Registra el consumo durante la ejecución del trabajo.');
        await tx.entregaMaterialItem.update({where:{id:item.id},data:{consumida:{increment:amount}}});
        await tx.productoInventario.update({where:{id:item.productoId},data:{stockActual:{decrement:amount}}});
        await tx.materialEjecucion.create({data:{trabajoId:work.id,tipoOrigen:'INVENTARIO',productoId:item.productoId,descripcion:item.descripcion+' · ENT-'+delivery.numero,cantidad:amount,costoUnitario:item.costoUnitario,subtotalCosto:amount.mul(item.costoUnitario).toDecimalPlaces(2),consumido:true}});
      }
    }
    const actor=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
    const details={accion:input.accion,itemId:input.itemId??null,cantidad:input.cantidad??null,motivo:input.motivo,usuarioId:user.id,realizadoPor:actor.nombre};
    await tx.operacionEntrega.create({data:{id:key,entregaId:delivery.id,huella:fingerprint,datos:details}});
    await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'ENTREGAS',accion:'UPDATE',entidadTipo:'EntregaMaterial',entidadId:delivery.id,valoresNuevos:details}});
    return {success:true};
  },{timeout:20000});return NextResponse.json(result);
}catch(e){return apiError(e);}}
