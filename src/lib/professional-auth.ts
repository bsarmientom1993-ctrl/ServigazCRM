import {createHmac,createHash} from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type {NextRequest,NextResponse} from 'next/server';
import {jwtSecret} from './auth';
import {prisma} from './prisma';
import {ApiError} from './api';
const cookie='servigaz_profesional_token';
export function professionalSecret(){return createHmac('sha256',jwtSecret()).update('servigaz-profesionales-auth-v1').digest('hex');}
export function professionalToken(id:string){return jwt.sign({id},professionalSecret(),{algorithm:'HS256',audience:'servigaz-profesionales',expiresIn:'7d'});}
export function professionalCookie(response:NextResponse,id:string){response.cookies.set(cookie,professionalToken(id),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});}
export async function requireProfessional(req:NextRequest,approved=false){
 const token=req.cookies.get(cookie)?.value;if(!token)throw new ApiError(401,'Ingresa al portal profesional.');
 let id:string;try{const d=jwt.verify(token,professionalSecret(),{algorithms:['HS256'],audience:'servigaz-profesionales'});if(typeof d==='string'||typeof d.id!=='string')throw Error();id=d.id;}catch{throw new ApiError(401,'Tu sesión del portal venció. Ingresa nuevamente.');}
 const account=await prisma.cuentaProfesional.findUnique({where:{id}});if(!account||account.estado==='SUSPENDIDA')throw new ApiError(403,'El acceso profesional no está habilitado. Contacta a Servigaz.');
 if(approved&&account.estado!=='APROBADA')throw new ApiError(403,'Los pedidos y precios profesionales requieren documentos verificados y aprobación del administrador.');
 return account;
}
export async function professionalRate(req:NextRequest,action:string,email=''){
 const ip=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'local').split(',')[0].trim().slice(0,80);
 const bucket=Math.floor(Date.now()/900000);
 for(const scope of ['ip:'+ip,'email:'+email.toLowerCase()]){const key=createHash('sha256').update(professionalSecret()+action+scope+bucket).digest('hex');
 const count=await prisma.accesoProfesionalRate.upsert({where:{clave:key},create:{clave:key,venceAt:new Date(Date.now()+3600000)},update:{intentos:{increment:1}}});
 if(count.intentos>(action==='registro'?5:30))throw new ApiError(429,'Demasiados intentos. Vuelve a intentar en unos minutos.');
 }
 await prisma.accesoProfesionalRate.deleteMany({where:{venceAt:{lt:new Date()}}});
}
