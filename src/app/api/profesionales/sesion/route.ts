import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {prisma} from '@/lib/prisma';
import {apiError,ApiError} from '@/lib/api';
import {requireProfessional,professionalCookie,professionalRate} from '@/lib/professional-auth';
import {boundedJson,requiredDocuments,documentTypes} from '@/lib/professional-policy';
export async function GET(req:NextRequest){try{const a=await requireProfessional(req);const [documents,config]=await Promise.all([prisma.documentoProfesional.findMany({where:{cuentaId:a.id},orderBy:{createdAt:'desc'},select:{id:true,tipo:true,nombre:true,mediaType:true,verificadoAt:true,observacion:true,createdAt:true}}),prisma.configuracionProfesionales.findUnique({where:{id:'general'}})]);
 return NextResponse.json({cuenta:{id:a.id,nombre:a.nombre,empresa:a.empresa,email:a.email,telefono:a.telefono,estado:a.estado,revisionNota:a.revisionNota,descuentoPct:a.estado==='APROBADA'?String(a.descuentoPct):null},documentos:documents,requeridos:config?.documentosRequeridos||requiredDocuments,tiposDocumento:documentTypes},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{const body=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(1).max(100)}).strict().parse(await boundedJson(req));await professionalRate(req,'ingreso',body.email);const account=await prisma.cuentaProfesional.findUnique({where:{email:body.email}});
 if(!account||!await bcrypt.compare(body.password,account.passwordHash))throw new ApiError(401,'Correo o contraseña incorrectos.');if(account.estado==='SUSPENDIDA')throw new ApiError(403,'La cuenta está suspendida. Contacta a Servigaz.');
 const device=req.cookies.get('servigaz_push_device')?.value;if(device)await prisma.dispositivoPush.updateMany({where:{id:device},data:{activa:false}});
 const response=NextResponse.json({success:true});professionalCookie(response,account.id);return response;
}catch(e){return apiError(e);}}
export async function DELETE(req:NextRequest){const device=req.cookies.get('servigaz_push_device')?.value;if(device){try{const a=await requireProfessional(req);await prisma.dispositivoPush.updateMany({where:{id:device,destinatario:'profesional:'+a.id},data:{activa:false}});}catch{}}
 const response=NextResponse.json({success:true});response.cookies.delete('servigaz_profesional_token');return response;
}
