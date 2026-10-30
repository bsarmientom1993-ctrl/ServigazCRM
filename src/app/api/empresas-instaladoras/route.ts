import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {documentTypes,requiredDocuments,boundedJson} from '@/lib/professional-policy';
import {queueNotice} from '@/lib/notifications';
export async function GET(req:NextRequest){try{await requireSession(req,['ADMIN']);const [accounts,branches,config]=await Promise.all([prisma.cuentaProfesional.findMany({orderBy:{updatedAt:'desc'},take:200,select:{id:true,email:true,nombre:true,empresa:true,identificacionEmpresa:true,telefono:true,direccion:true,estado:true,descuentoPct:true,clienteId:true,sucursalId:true,revisionNota:true,aprobadaPorNombre:true,aprobadaAt:true,createdAt:true,updatedAt:true}}),prisma.sucursal.findMany({where:{activo:true},select:{id:true,nombre:true}}),prisma.configuracionProfesionales.findUnique({where:{id:'general'}})]);
 const docs=await prisma.documentoProfesional.findMany({where:{cuentaId:{in:accounts.map(a=>a.id)}},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{id:true,cuentaId:true,tipo:true,nombre:true,mediaType:true,verificadoAt:true,verificadoPorNombre:true,observacion:true,createdAt:true}});
 return NextResponse.json({cuentas:accounts.map(a=>({...a,documentos:docs.filter(d=>d.cuentaId===a.id)})),sucursales:branches,requeridos:config?.documentosRequeridos||requiredDocuments,tiposDocumento:documentTypes},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{const session=await requireSession(req,['ADMIN']);
 const body=z.discriminatedUnion('accion',[
 z.object({accion:z.literal('DOCUMENTOS_REQUERIDOS'),tipos:z.array(z.enum(['REPRESENTANTE','EMPRESA','OTRO'])).min(1).max(3).refine(a=>new Set(a).size===a.length)}).strict(),
 z.object({accion:z.literal('VERIFICAR_DOCUMENTO'),id:z.string().uuid(),valido:z.boolean(),observacion:z.string().trim().min(3).max(1000)}).strict(),
 z.object({accion:z.literal('APROBAR'),id:z.string().uuid(),sucursalId:z.string().min(1).max(100),descuentoPct:z.number().finite().positive().max(99.99).refine(v=>Math.abs(v*100-Math.round(v*100))<0.000001,"Usa hasta dos decimales."),documentosVerificados:z.literal(true)}).strict(),
 z.object({accion:z.literal('TARIFA'),id:z.string().uuid(),descuentoPct:z.number().finite().positive().max(99.99).refine(v=>Math.abs(v*100-Math.round(v*100))<0.000001,"Usa hasta dos decimales."),motivo:z.string().trim().min(10).max(1000)}).strict(),
 z.object({accion:z.literal('ESTADO'),id:z.string().uuid(),estado:z.enum(['RECHAZADA','SUSPENDIDA']),motivo:z.string().trim().min(10).max(1000)}).strict(),
 ]).parse(await boundedJson(req));
 const result=await prisma.$transaction(async tx=>{const actor=await tx.usuario.findUniqueOrThrow({where:{id:session.id},select:{nombre:true}});
 if(body.accion==='DOCUMENTOS_REQUERIDOS'){await tx.configuracionProfesionales.upsert({where:{id:'general'},create:{id:'general',documentosRequeridos:body.tipos,modificadoPorNombre:actor.nombre},update:{documentosRequeridos:body.tipos,modificadoPorNombre:actor.nombre}});await tx.auditoriaLog.create({data:{usuarioId:session.id,modulo:'PROFESIONALES',accion:'UPDATE',entidadTipo:'ConfiguracionProfesionales',entidadId:'general',valoresNuevos:{documentos:body.tipos,realizadoPor:actor.nombre}}});return{success:true};}
 const doc=body.accion==='VERIFICAR_DOCUMENTO'?await tx.documentoProfesional.findUnique({where:{id:body.id},select:{cuentaId:true}}):null;
 const id=body.accion==='VERIFICAR_DOCUMENTO'?doc?.cuentaId:body.id;if(!id)throw new ApiError(404,'Documento no encontrado.');
 const locks=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "CuentaProfesional" WHERE id=${id} FOR UPDATE`;if(!locks.length)throw new ApiError(404,'Cuenta no encontrada.');const before=await tx.cuentaProfesional.findUniqueOrThrow({where:{id}});
 let changes:any={},event='';
 if(body.accion==='VERIFICAR_DOCUMENTO'){await tx.documentoProfesional.update({where:{id:body.id},data:{verificadoAt:body.valido?new Date():null,verificadoPorNombre:actor.nombre,observacion:body.observacion}});event=body.valido?'Documento verificado':'Documento observado';}
 if(body.accion==='APROBAR'){
   if(before.estado==='APROBADA')return{success:true};
   const documents=await tx.documentoProfesional.findMany({where:{cuentaId:id},orderBy:[{createdAt:'desc'},{id:'desc'}]});const config=await tx.configuracionProfesionales.findUnique({where:{id:'general'}}),needed=(config?.documentosRequeridos||requiredDocuments) as string[];
   if(!needed.every(type=>documents.find(d=>d.tipo===type)?.verificadoAt))throw new ApiError(409,'Verifica el documento más reciente de cada tipo requerido antes de aprobar.');
   const branch=await tx.sucursal.findFirst({where:{id:body.sucursalId,activo:true},select:{id:true}});if(!branch)throw new ApiError(400,'Selecciona una sucursal activa.');
   if(before.clienteId&&before.sucursalId!==branch.id)throw new ApiError(409,'Conserva la sucursal del cliente ya vinculado.');
   const client=before.clienteId?await tx.cliente.findUniqueOrThrow({where:{id:before.clienteId}}):await tx.cliente.create({data:{nombreCompleto:before.empresa+' · '+before.nombre,email:before.email,telefonos:[before.telefono],direccion:before.direccion,sucursalId:branch.id,descuentoVipPct:body.descuentoPct}});
   changes={estado:'APROBADA',clienteId:client.id,sucursalId:branch.id,descuentoPct:body.descuentoPct,aprobadaPorNombre:actor.nombre,aprobadaAt:new Date(),revisionNota:''};event='Cuenta aprobada';
 }else if(body.accion==='TARIFA'){if(before.estado!=='APROBADA')throw new ApiError(409,'La cuenta debe estar aprobada para ajustar su tarifa.');changes={descuentoPct:body.descuentoPct};event='Tarifa profesional actualizada';}
 else if(body.accion==='ESTADO'){changes={estado:body.estado,revisionNota:body.motivo};event=body.estado==='SUSPENDIDA'?'Acceso suspendido':'Solicitud observada';}
 if(Object.keys(changes).length)await tx.cuentaProfesional.update({where:{id},data:changes});
 if((body.accion==='APROBAR'||body.accion==='TARIFA')&&before.clienteId)await tx.cliente.update({where:{id:before.clienteId},data:{descuentoVipPct:body.descuentoPct}});
 await tx.auditoriaLog.create({data:{usuarioId:session.id,modulo:'PROFESIONALES',accion:'UPDATE',entidadTipo:'CuentaProfesional',entidadId:id,valoresAnteriores:{estado:before.estado,descuentoPct:String(before.descuentoPct)},valoresNuevos:{evento:event,realizadoPor:actor.nombre,...(body.accion==='ESTADO'||body.accion==='TARIFA'?{motivo:body.motivo}:{}),...(body.accion==='APROBAR'||body.accion==='TARIFA'?{descuentoPct:body.descuentoPct}:{})}}});
 await queueNotice(tx,['profesional:'+id],'revision-profesional:'+id+':'+Date.now(),'CUENTA','Novedades de tu cuenta profesional','Servigaz actualizó el estado de revisión de tu registro. Consulta el portal para ver el detalle.','/profesionales');return{success:true};
 });return NextResponse.json(result);
}catch(e){return apiError(e);}}
