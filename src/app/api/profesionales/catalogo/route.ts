import {NextRequest,NextResponse} from 'next/server';
import {requireProfessional} from '@/lib/professional-auth';
import {apiError} from '@/lib/api';
import {prisma} from '@/lib/prisma';
import {professionalPrice} from '@/lib/professional-policy';
import {cents} from '@/lib/workflow-policy';
import {storeConfig} from '@/lib/store';
export async function GET(req:NextRequest){try{const user=await requireProfessional(req),approved=user.estado==='APROBADA';
 const [products,categories,configuration]=await Promise.all([prisma.tiendaPublicacion.findMany({where:{publicado:true,producto:{activo:true,precioVenta:{gt:0}}},select:{productoId:true,descripcion:true,imagenHash:true,producto:{select:{nombre:true,codigoSku:true,categoria:true,unidadMedida:true,precioVenta:true}}},orderBy:{producto:{nombre:'asc'}}}),prisma.catalogoCategoria.findMany({where:{activo:true},select:{codigo:true,nombre:true,requiereVisita:true,subtipos:{where:{activo:true},select:{codigo:true,nombre:true}}}}),prisma.tiendaConfiguracion.findUnique({where:{id:'general'}})]);
 const config=storeConfig(configuration?.datos);
 return NextResponse.json({aprobada:approved,descuentoPct:approved?String(user.descuentoPct):null,whatsapp:config.whatsapp,productos:products.map(p=>({id:p.productoId,nombre:p.producto.nombre,sku:p.producto.codigoSku,categoria:p.producto.categoria,unidad:p.producto.unidadMedida,descripcion:p.descripcion,precioPublico:cents(p.producto.precioVenta)/100,precio:approved?professionalPrice(cents(p.producto.precioVenta),Number(user.descuentoPct))/100:cents(p.producto.precioVenta)/100,imagen:p.imagenHash?'/api/tienda/imagenes/'+p.productoId+'?v='+p.imagenHash:null})),servicios:categories.filter(c=>!['PROVISION','PROVISION_INSTALACION'].includes(c.codigo)).flatMap(c=>c.subtipos.map(s=>({...s,categoria:c.nombre,requiereVisita:c.requiereVisita})))},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
