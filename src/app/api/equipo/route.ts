import {NextRequest,NextResponse} from 'next/server';
import {requireSession,managers} from '@/lib/auth';
import {apiError} from '@/lib/api';
import {prisma} from '@/lib/prisma';
export async function GET(req:NextRequest){try{const user=await requireSession(req,["ADMIN","ENCARGADO","VENTAS"]);return NextResponse.json(await prisma.usuario.findMany({where:{estado:'ACTIVO',...(user.rol==='ADMIN'?{}:{sucursalId:user.sucursalId})},select:{id:true,nombre:true},orderBy:{nombre:'asc'}}));}catch(error){return apiError(error);}}
