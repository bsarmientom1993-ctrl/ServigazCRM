import {assignedRoleWhere} from '@/lib/auth';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, inventoryOperators,proformaOperators } from '@/lib/auth';
import { apiError, ApiError } from '@/lib/api';
import { documentInput, documentScope, requireDocument, operationalWork, DocumentData, safeDelivery } from '@/lib/proformas';
import { lockLocations, locationForOperation, quantity } from '@/lib/inventory';
import { cents } from '@/lib/workflow-policy';
import { resolveQuoteTemplate } from '@/lib/quote-template';

export async function GET(req:NextRequest){try{
  const user=await requireSession(req);const id=req.nextUrl.searchParams.get('id');
  const result=await prisma.$transaction(async tx=>{
    const documentos=await tx.documentoProforma.findMany({where:{AND:[await documentScope(tx,user),...(id?[{id}]:[])]},include:{entregas:{include:{items:true,operaciones:{orderBy:{createdAt:'asc'}}},orderBy:{createdAt:'desc'}}},orderBy:{createdAt:'desc'},take:id?1:200});
    return documentos.map(d=>{const {formato,huella,...summary}=d.datos as unknown as DocumentData;return {...d,datos:id?d.datos:summary,entregas:d.entregas.map(e=>safeDelivery(e,user.rol==='TECNICO_FIJO'))};});
  });return NextResponse.json({documentos:result});
}catch(e){return apiError(e);}}

export async function POST(req:NextRequest){try{
  const user=await requireSession(req);const input=documentInput.parse(await req.json());
  const huella=createHash('sha256').update(user.id+JSON.stringify(input)).digest('hex');
  if(user.rol==='TECNICO_FIJO'&&(input.tipo!=='MATERIALES'||input.tecnicoId!==user.id))throw new ApiError(403,'Solo puedes solicitar materiales para tus trabajos.');
  if(user.rol==='VENTAS'&&input.tipo!=='CLIENTE')throw new ApiError(403,'Ventas solo prepara proformas para clientes.');
  if(input.tipo==='CLIENTE'&&!proformaOperators.includes(user.rol))throw new ApiError(403,'Tu rol no puede emitir proformas comerciales.');
  if(new Set(input.items.map(i=>i.productoId)).size!==input.items.length)throw new ApiError(400,'Agrupa las cantidades de cada producto en una sola línea.');
  const until=new Date(input.validoHasta);if(until<=new Date()||until.getTime()>Date.now()+366*86400000)throw new ApiError(400,'La validez debe ser futura y de hasta un año.');
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.id},0))`;
    const previous=await tx.documentoProforma.findUnique({where:{id:input.id}});
    if(previous){if(previous.creadoPorId!==user.id||(previous.datos as unknown as DocumentData).huella!==huella)throw new ApiError(409,'La clave del documento ya existe con otros datos.');return requireDocument(tx,user,input.id);}
    await lockLocations(tx,[input.ubicacionId]);
    const requestedCentral=user.rol==='TECNICO_FIJO'&&input.tipo==='MATERIALES'?await tx.ubicacionInventario.findFirst({where:{id:input.ubicacionId,activo:true,esInicial:false,tipo:'ALMACEN',sucursalId:null}}):null;
    const location=requestedCentral||await locationForOperation(tx,user,input.ubicacionId);
    if(location.esInicial)throw new ApiError(400,'Selecciona una tienda o almacén operativo.');
    const author=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
    const datos:DocumentData={autor:author.nombre,huella,ubicacion:location.nombre,observaciones:input.observaciones,condiciones:input.condiciones,items:[]};
    let clientId:string|null=null,techId:string|null=null,workId:string|null=null;
    if(input.tipo==='CLIENTE'){
      datos.formato=resolveQuoteTemplate((await tx.formatoCotizacion.findUnique({where:{id:'general'}}))?.formato);
      if(!input.clienteId)throw new ApiError(400,'Registra o selecciona un cliente antes de emitir la proforma.');
      const client=await tx.cliente.findUnique({where:{id:input.clienteId}});
      if(!client||user.rol!=='ADMIN'&&client.sucursalId!==location.sucursalId)throw new ApiError(403,'Selecciona un cliente de esta sucursal.');
      datos.cliente=client.nombreCompleto;clientId=client.id;
    }else{
      if(!input.tecnicoId||!input.trabajoId)throw new ApiError(400,'Selecciona el técnico y el trabajo.');
      const tech=await tx.usuario.findFirst({where:{id:input.tecnicoId,...assignedRoleWhere('TECNICO_FIJO'),estado:'ACTIVO'}});
      if(!tech)throw new ApiError(400,'Selecciona un técnico activo.');
      const work=await operationalWork(tx,user,input.trabajoId,tech.id,location.sucursalId);
      if(user.rol!=='ADMIN'&&!(['ALMACENERO','TECNICO_FIJO'].includes(user.rol)&&location.tipo==='ALMACEN'&&!location.sucursalId)&&work.sucursalId!==location.sucursalId)throw new ApiError(403,'La solicitud debe salir de la sucursal del trabajo.');
      techId=tech.id;workId=work.id;datos.tecnico=tech.nombre;datos.trabajo=work.codigoCorrelativo;
    }
    let total=new Prisma.Decimal(0);
    for(const line of input.items){
      const product=await tx.productoInventario.findFirst({where:{id:line.productoId,activo:true}});if(!product)throw new ApiError(400,'Producto no disponible.');
      const amount=quantity(line.cantidad);const item:DocumentData['items'][number]={productoId:product.id,descripcion:product.nombre,unidad:product.unidadMedida,cantidad:String(amount)};
      if(input.tipo==='CLIENTE'){const price=new Prisma.Decimal(line.precio??product.precioVenta);cents(Number(price));const subtotal=amount.mul(price).toDecimalPlaces(2);cents(Number(subtotal));item.precio=String(price);item.subtotal=String(subtotal);total=total.add(subtotal);}
      datos.items.push(item);
    }
    if(input.tipo==='CLIENTE'){cents(Number(total));datos.total=String(total);}
    const doc=await tx.documentoProforma.create({data:{id:input.id,tipo:input.tipo,ubicacionId:location.id,clienteId:clientId,tecnicoId:techId,trabajoId:workId,creadoPorId:user.id,datos:datos as unknown as Prisma.InputJsonValue,validoHasta:until}});
    await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'PROFORMAS',accion:'CREATE',entidadTipo:'DocumentoProforma',entidadId:doc.id,valoresNuevos:{numero:doc.numero,tipo:doc.tipo,realizadoPor:author.nombre}}});return doc;
  },{timeout:15000});return NextResponse.json(result);
}catch(e){return apiError(e);}}

export async function PATCH(req:NextRequest){try{
  const user=await requireSession(req,inventoryOperators);const input=z.object({id:z.string().uuid(),estado:z.enum(['APROBADA','RECHAZADA','ANULADA']),motivo:z.string().trim().min(3).max(1000)}).parse(await req.json());
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "DocumentoProforma" WHERE id=${input.id} FOR UPDATE`;const doc=await requireDocument(tx,user,input.id);
    if(doc.estado===input.estado)return doc;
    if(doc.estado!=='PENDIENTE'&&input.estado!=='ANULADA')throw new ApiError(409,'El documento ya tiene una decisión. Emite uno nuevo para corregirlo.');
    if(input.estado==='APROBADA'&&doc.validoHasta<new Date())throw new ApiError(409,'El documento está vencido.');
    if(await tx.entregaMaterial.count({where:{proformaId:doc.id}}))throw new ApiError(409,'Hay entregas registradas; concilia sus materiales sin anular el documento.');
    const actor=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
    const updated=await tx.documentoProforma.update({where:{id:doc.id},data:{estado:input.estado,decisionMotivo:actor.nombre+': '+input.motivo,decididoPorId:user.id}});
    await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:'PROFORMAS',accion:'UPDATE',entidadTipo:'DocumentoProforma',entidadId:doc.id,valoresAnteriores:{estado:doc.estado},valoresNuevos:{estado:input.estado,motivo:input.motivo,realizadoPor:actor.nombre}}});return updated;
  });return NextResponse.json(result);
}catch(e){return apiError(e);}}
