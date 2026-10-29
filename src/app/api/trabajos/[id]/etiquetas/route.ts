import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { addMonths } from 'date-fns';
import { z } from 'zod';
import type { EtiquetaGarantia } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession, assertWorkAccess } from '@/lib/auth';
import { ApiError, apiError } from '@/lib/api';
import { withWork } from '@/lib/workflow';
import { isIndependentProject } from '@/lib/work-responsibility-data';
import { warrantyLabelSchema, sealStatus } from '@/lib/warranty-labels';
const operators = ['ADMIN','ENCARGADO','TECNICO_FIJO'] as const;
const scope = { id:true, tecnicoId:true, encargadoId:true, sucursalId:true, codigoCorrelativo:true, subtipoCodigo:true } as const;
function visible(label:EtiquetaGarantia) { const { solicitudHash, ...safe }=label; return {...safe,estado:sealStatus(label)}; }
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await requireSession(req,[...operators]), {id}=await params;
    const work=await prisma.trabajo.findUnique({where:{id},select:scope});
    if(!work)throw new ApiError(404,'Trabajo no encontrado.');
    assertWorkAccess(user,work);
    const [labels,config]=await Promise.all([
      prisma.etiquetaGarantia.findMany({where:{trabajoId:id},orderBy:{createdAt:'desc'}}),
      prisma.configuracionGarantia.findUnique({where:{subtipoCodigo:work.subtipoCodigo},select:{activo:true,mesesDefecto:true,condiciones:true}}),
    ]);
    return NextResponse.json({codigoTrabajo:work.codigoCorrelativo,etiquetas:labels.map(visible),config},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return apiError(error);}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await requireSession(req,[...operators]), {id}=await params;
    const key=z.string().uuid().parse(req.headers.get('Idempotency-Key'));
    const data=warrantyLabelSchema.parse(await req.json());
    const hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const result=await withWork(id,user,async(tx,actor)=>{
      const prior=await tx.etiquetaGarantia.findUnique({where:{id:key}});
      if(prior){if(prior.trabajoId!==id||prior.emitidaPorId!==user.id||prior.solicitudHash!==hash)throw new ApiError(409,'La solicitud corresponde a otra etiqueta.');return prior;}
      const work=await tx.trabajo.findUniqueOrThrow({where:{id},include:{
        visitas:{where:{completada:true},select:{id:true}},
        cotizaciones:{orderBy:{numeroVersion:'desc'},take:1,select:{id:true,estado:true}},
      }});
      if(isIndependentProject(work)||work.estado==='CANCELADO')throw new ApiError(409,'Este trabajo no admite una etiqueta de equipo.');
      if(data.operacion==='VENTA') {
        if(user.rol==='TECNICO_FIJO')throw new ApiError(403,'El encargado o administrador emite las etiquetas de venta.');
        if(work.cotizaciones[0]?.estado!=='APROBADA')throw new ApiError(409,'Registra la aceptación de la propuesta vigente antes de emitir una etiqueta de venta.');
      } else if(!work.visitas.length&&!['TERMINADO_TECNICO','VALIDADO','FINALIZADO_FINANCIERO'].includes(work.estado)) {
        throw new ApiError(409,'Registra primero la revisión realizada o la terminación técnica.');
      }
      const config=await tx.configuracionGarantia.findUnique({where:{subtipoCodigo:work.subtipoCodigo}});
      if(!config?.activo||config.mesesDefecto<=0)throw new ApiError(409,'El administrador debe configurar la cobertura de garantía de este servicio.');
      if(data.serie&&await tx.etiquetaGarantia.findFirst({where:{trabajoId:id,serie:data.serie,anuladaAt:null}}))throw new ApiError(409,'Este equipo ya tiene un sello. Reimprime el existente o registra su rotura antes de emitir otro.');
      const start=new Date();
      const saved=await tx.etiquetaGarantia.create({data:{...data,id:key,trabajoId:id,
        codigo:'SEL-'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),
        condiciones:config.condiciones||'',fechaInicio:start,fechaFin:addMonths(start,config.mesesDefecto),
        emitidaPorId:actor.id,emitidaPorNombre:actor.nombre,solicitudHash:hash,
      }});
      await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'ETIQUETAS_GARANTIA',accion:'CREATE',entidadTipo:'EtiquetaGarantia',entidadId:saved.id,
        valoresNuevos:{trabajoId:id,codigo:saved.codigo,equipo:saved.equipo,serie:saved.serie,operacion:saved.operacion,realizadoPor:actor.nombre,cobertura:saved.cobertura}}});
      return saved;
    });
    return NextResponse.json(visible(result),{status:201});
  } catch(error){return apiError(error);}
}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await requireSession(req,[...operators]), {id}=await params;
    const body=z.object({etiquetaId:z.string().uuid(),motivo:z.string().trim().min(10).max(500),selloRotoConfirmado:z.literal(true)}).strict().parse(await req.json());
    const result=await withWork(id,user,async(tx,actor)=>{
      const label=await tx.etiquetaGarantia.findUnique({where:{id:body.etiquetaId}});
      if(!label||label.trabajoId!==id)throw new ApiError(404,'Etiqueta no encontrada en este trabajo.');
      if(label.anuladaAt)return label;
      const saved=await tx.etiquetaGarantia.update({where:{id:label.id},data:{anuladaAt:new Date(),anuladaPorId:actor.id,anuladaPorNombre:actor.nombre,motivoAnulacion:body.motivo}});
      await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'ETIQUETAS_GARANTIA',accion:'UPDATE',entidadTipo:'EtiquetaGarantia',entidadId:label.id,
        valoresAnteriores:{estado:sealStatus(label)},valoresNuevos:{estado:'ANULADA',trabajoId:id,motivo:body.motivo,realizadoPor:actor.nombre}}});
      return saved;
    });
    return NextResponse.json(visible(result));
  }catch(error){return apiError(error);}
}
