import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {requireProfessional} from '@/lib/professional-auth';
import {apiError,ApiError} from '@/lib/api';
import {boundedBytes,requiredDocuments} from '@/lib/professional-policy';
import {createDocumentStorage} from '../../../../../scripts/lib/private-document-r2.cjs';
import {assignedRoleWhere} from '@/lib/auth';
import {queueNotice} from '@/lib/notifications';
export async function POST(req:NextRequest){try{const user=await requireProfessional(req);const key=z.string().uuid().parse(req.headers.get('Idempotency-Key'));if(!req.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new ApiError(400,'Selecciona un documento.');
 const raw=await boundedBytes(req,3100000),form=await new Response(raw,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();const tipo=z.enum(['REPRESENTANTE','EMPRESA','OTRO']).parse(form.get('tipo')),file=form.get('archivo');if(!file||typeof file==='string'||file.size<1||file.size>3000000)throw new ApiError(400,'Selecciona un PDF o imagen de hasta 3 MB.');
 let bytes=Buffer.from(await file.arrayBuffer()),type='application/pdf',extension='pdf';
 if(bytes.subarray(0,5).toString()!=='%PDF-'){try{const image=sharp(bytes,{limitInputPixels:25000000});const metadata=await image.metadata();if(!['jpeg','png','webp'].includes(metadata.format||''))throw Error();bytes=await image.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();if(bytes.length>3000000)throw Error();type='image/jpeg';extension='jpg';}catch{throw new ApiError(400,'El documento debe ser un PDF o una imagen JPG, PNG o WebP válida.');}}
 const hash=createHash('sha256').update(bytes).digest('hex');const result=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "CuentaProfesional" WHERE id=${user.id} FOR UPDATE`;
 const current=await tx.cuentaProfesional.findUniqueOrThrow({where:{id:user.id}});if(!['PENDIENTE_DOCUMENTOS','EN_REVISION','RECHAZADA'].includes(current.estado))throw new ApiError(409,'La cuenta no admite cambios de documentos en este estado.');
 const prior=await tx.documentoProfesional.findUnique({where:{id:key}});if(prior){if(prior.cuentaId!==user.id||prior.sha256!==hash||prior.tipo!==tipo)throw new ApiError(409,'La solicitud corresponde a otro documento.');return{id:prior.id};}
 const duplicate=await tx.documentoProfesional.findUnique({where:{cuentaId_tipo_sha256:{cuentaId:user.id,tipo,sha256:hash}}});if(duplicate)return{id:duplicate.id};
 if(await tx.documentoProfesional.count({where:{cuentaId:user.id}})>=20)throw new ApiError(409,'Llegaste al límite de documentos. Contacta a Servigaz para continuar.');
 let objectKey:string|null=null,contenido:Uint8Array<ArrayBuffer>|null=new Uint8Array(bytes);
 if(process.env.PHOTO_STORAGE==='r2'){const storage=createDocumentStorage();try{objectKey=`profesionales/${user.id}/documentos/${key}-${hash}.${extension}`;await storage.put(objectKey,bytes,hash,type);contenido=null;}catch{throw new ApiError(503,'No se pudo guardar el documento privado. Intenta nuevamente.');}finally{storage.close();}}
 await tx.documentoProfesional.create({data:{id:key,cuentaId:user.id,tipo,nombre:file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,120),mediaType:type,sha256:hash,contenido,objectKey}});
 const config=await tx.configuracionProfesionales.findUnique({where:{id:'general'}}),needed=(config?.documentosRequeridos||requiredDocuments) as string[];
 const docs=await tx.documentoProfesional.findMany({where:{cuentaId:user.id},select:{tipo:true}});const complete=needed.every(t=>docs.some(d=>d.tipo===t));await tx.cuentaProfesional.update({where:{id:user.id},data:{estado:complete?'EN_REVISION':'PENDIENTE_DOCUMENTOS',revisionNota:''}});
 await tx.auditoriaLog.create({data:{modulo:'PROFESIONALES_DOCUMENTOS',accion:'CREATE',entidadTipo:'DocumentoProfesional',entidadId:key,valoresNuevos:{cuentaId:user.id,tipo,estado:complete?'EN_REVISION':'PENDIENTE_DOCUMENTOS'}}});
 if(complete){const admins=await tx.usuario.findMany({where:{estado:'ACTIVO',...assignedRoleWhere('ADMIN')},select:{id:true}});await queueNotice(tx,admins.map(a=>'personal:'+a.id),'documentos-profesionales:'+key,'PROFESIONALES','Documentos para verificar','Una empresa instaladora completó sus documentos y espera revisión.','/empresas-instaladoras');}
 return{id:key};
 },{timeout:30000});return NextResponse.json(result,{status:201});
}catch(e){return apiError(e);}}
