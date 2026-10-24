import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError,ApiError } from '@/lib/api';
import { storeConfig } from '@/lib/store';
import { readPhoto } from '@/lib/photo-storage';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const config=storeConfig((await prisma.tiendaConfiguracion.findUnique({where:{id:'general'}}))?.datos);
    if(!config.activa)throw new ApiError(404,'Imagen no disponible.');
    const item=await prisma.tiendaPublicacion.findFirst({where:{productoId:id,publicado:true,producto:{activo:true,precioVenta:{gt:0}}},select:{imagenContenido:true,imagenKey:true,imagenHash:true}});
    if(!item?.imagenHash)throw new ApiError(404,'Imagen no disponible.');
    const bytes=await readPhoto({contenido:item.imagenContenido,objectKey:item.imagenKey,sha256:item.imagenHash});
    return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return apiError(error);}
}
