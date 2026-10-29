import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {requireSession,intakeOperators} from '@/lib/auth';
import {apiError,ApiError} from '@/lib/api';
import {rolesOf} from '@/lib/user-roles';
import {receptionData} from '@/lib/reception';
export async function GET(req:NextRequest){try{
 const user=await requireSession(req,intakeOperators);
 const branch=user.rol==='ADMIN'?req.nextUrl.searchParams.get('sucursalId')||user.sucursalId:user.sucursalId;
 const sucursales=await prisma.sucursal.findMany({where:{activo:true,...(user.rol==='ADMIN'?{}:{id:user.sucursalId||''})},select:{id:true,nombre:true},orderBy:{nombre:'asc'}});
 if(branch&&!sucursales.some(b=>b.id===branch))throw new ApiError(403,'Sucursal no disponible.');
 const q=(req.nextUrl.searchParams.get('q')||'').trim().toLowerCase().slice(0,100),clientId=req.nextUrl.searchParams.get('clienteId');
 const [clients,team,works]=branch?await Promise.all([
   prisma.cliente.findMany({where:{sucursalId:branch},select:{id:true,nombreCompleto:true,telefonos:true,direccion:true,email:true,_count:{select:{trabajos:true}}},orderBy:{nombreCompleto:'asc'}}),
   prisma.usuario.findMany({where:{estado:'ACTIVO',OR:[{sucursalId:branch},{rol:'ADMIN'}]},select:{id:true,nombre:true,rol:true,rolesAsignados:true},orderBy:{nombre:'asc'}}),
   prisma.trabajo.findMany({where:{sucursalId:branch,...(clientId?{clienteId:clientId}:{})},select:{id:true,codigoCorrelativo:true,estado:true,subtipoNombre:true,fechasSla:true,createdAt:true,cliente:{select:{nombreCompleto:true}},encargado:{select:{nombre:true}},garantia:{select:{codigoCertificado:true,fechaFin:true,activo:true}}},orderBy:{createdAt:'desc'},take:50}),
 ]):[[],[],[]];
 const digits=(s:string)=>s.replace(/\D/g,'');
 const clientes=clients.filter(c=>!q||c.nombreCompleto.toLowerCase().includes(q)||Array.isArray(c.telefonos)&&c.telefonos.some(p=>typeof p==='string'&&(p.includes(q)||digits(q).length>=3&&digits(p).includes(digits(q))))).slice(0,12);
 return NextResponse.json({sucursalId:branch,sucursales,clientes,equipo:team.map(u=>({id:u.id,nombre:u.nombre,coordina:rolesOf(u).some(r=>r==='ADMIN'||r==='ENCARGADO')})),trabajos:works.map(({fechasSla,...w})=>({...w,recepcion:receptionData(fechasSla)}))},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
