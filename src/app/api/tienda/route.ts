import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storeConfig } from '@/lib/store';
import { apiError } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const config = storeConfig((await prisma.tiendaConfiguracion.findUnique({where:{id:'general'}}))?.datos);
    if (!config.activa) return NextResponse.json({config:{...config,whatsapp:''},productos:[]},{headers:{'Cache-Control':'no-store'}});
    const records = await prisma.tiendaPublicacion.findMany({where:{publicado:true,producto:{activo:true,precioVenta:{gt:0}}},select:{productoId:true,descripcion:true,destacado:true,imagenHash:true,producto:{select:{nombre:true,codigoSku:true,categoria:true,unidadMedida:true,precioVenta:true}}},orderBy:[{destacado:'desc'},{producto:{nombre:'asc'}}]});
    return NextResponse.json({config,productos:records.map(record=>({id:record.productoId,...record.producto,precioVenta:undefined,precio:Number(record.producto.precioVenta),descripcion:record.descripcion,destacado:record.destacado,imagen:record.imagenHash ? '/api/tienda/imagenes/'+record.productoId+'?v='+record.imagenHash : null}))},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return apiError(error); }
}
