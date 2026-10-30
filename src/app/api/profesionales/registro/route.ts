import {NextRequest,NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {prisma} from '@/lib/prisma';
import {apiError,ApiError} from '@/lib/api';
import {registrationSchema,boundedJson} from '@/lib/professional-policy';
import {professionalRate,professionalCookie} from '@/lib/professional-auth';
import {queueNotice} from '@/lib/notifications';
import {assignedRoleWhere} from '@/lib/auth';
export async function POST(req:NextRequest){try{
 const body=registrationSchema.parse(await boundedJson(req));await professionalRate(req,'registro',body.email);
 if(await prisma.cuentaProfesional.findUnique({where:{email:body.email},select:{id:true}}))throw new ApiError(409,'Ya existe un registro con este correo. Ingresa al portal o contacta a Servigaz.');
 const {password,...profile}=body,passwordHash=await bcrypt.hash(password,12);
 const account=await prisma.$transaction(async tx=>{const account=await tx.cuentaProfesional.create({data:{...profile,passwordHash}});const admins=await tx.usuario.findMany({where:{estado:'ACTIVO',...assignedRoleWhere('ADMIN')},select:{id:true}});await queueNotice(tx,admins.map(a=>'personal:'+a.id),'alta-profesional:'+account.id,'PROFESIONALES','Nuevo registro profesional','Una empresa instaladora inició su registro. Sus precios especiales están pendientes de verificación.','/empresas-instaladoras');await tx.auditoriaLog.create({data:{modulo:'PROFESIONALES',accion:'CREATE',entidadTipo:'CuentaProfesional',entidadId:account.id,valoresNuevos:{estado:account.estado,origen:'REGISTRO_DEL_SOLICITANTE'}}});return account;});
 const device=req.cookies.get("servigaz_push_device")?.value;if(device)await prisma.dispositivoPush.updateMany({where:{id:device},data:{activa:false}});
 const response=NextResponse.json({id:account.id,estado:account.estado},{status:201});professionalCookie(response,account.id);return response;
}catch(e){return apiError(e);}}
