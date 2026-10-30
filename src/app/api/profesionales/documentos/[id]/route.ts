import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {requireProfessional} from '@/lib/professional-auth';
import {requireSession} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {createDocumentStorage} from '../../../../../../scripts/lib/private-document-r2.cjs';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;let accountId:string|undefined;if(req.nextUrl.searchParams.get('portal')==='1')accountId=(await requireProfessional(req)).id;else await requireSession(req,['ADMIN']);
 const doc=await prisma.documentoProfesional.findFirst({where:{id,...(accountId?{cuentaId:accountId}:{})}});if(!doc)throw new ApiError(404,'Documento no encontrado.');
 let bytes:Buffer;if(doc.contenido)bytes=Buffer.from(doc.contenido);else{if(!doc.objectKey)throw new ApiError(404,'Documento no disponible.');const storage=createDocumentStorage();try{bytes=await storage.get(doc.objectKey,doc.sha256);}finally{storage.close();}}
 return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':doc.mediaType,'Content-Disposition':`attachment; filename="documento-${doc.tipo.toLowerCase()}.${doc.mediaType==='application/pdf'?'pdf':'jpg'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}catch(e){return apiError(e);}}
