import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { requireSession } from '@/lib/auth';
import { apiError, ApiError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { storeConfig, storeConfigSchema } from '@/lib/store';
import { cents } from '@/lib/workflow-policy';
import { createR2Storage } from '../../../../scripts/lib/photo-r2.cjs';
export async function GET(req:NextRequest) {
  try {
    await requireSession(req,['ADMIN']);
    const config = storeConfig((await prisma.tiendaConfiguracion.findUnique({where:{id:'general'}}))?.datos);
    const products = await prisma.productoInventario.findMany({where:{activo:true},orderBy:{nombre:'asc'},select:{id:true,nombre:true,codigoSku:true,categoria:true,unidadMedida:true,precioVenta:true,publicacionTienda:{select:{descripcion:true,publicado:true,destacado:true,imagenHash:true}}}});
    return NextResponse.json({config,productos:products});
  } catch(error){return apiError(error);}
}
export async function PUT(req:NextRequest) {
  try {
    const actor = await requireSession(req,['ADMIN']);
    const body = z.discriminatedUnion('accion',[
      z.object({accion:z.literal('CONFIGURACION'),config:storeConfigSchema}),
      z.object({accion:z.literal('PRODUCTO'),productoId:z.string().uuid(),precio:z.number().positive().finite().max(9999999999.99),descripcion:z.string().trim().max(2000),publicado:z.boolean(),destacado:z.boolean(),imagen:z.string().max(4200000).optional(),quitarImagen:z.boolean().default(false)})
    ]).parse(await req.json());
    if(body.accion==='CONFIGURACION'){
      await prisma.$transaction(async tx=>{
        await tx.tiendaConfiguracion.upsert({where:{id:'general'},create:{id:'general',datos:body.config},update:{datos:body.config}});
        await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'TIENDA',accion:'UPDATE',entidadTipo:'TiendaConfiguracion',entidadId:'general',valoresNuevos:body.config}});
      });
      return NextResponse.json({success:true});
    }
    cents(body.precio);
    const product=await prisma.productoInventario.findUnique({where:{id:body.productoId}});
    if(!product?.activo)throw new ApiError(404,'Producto no disponible.');
    let imageData: {imagenContenido?:Uint8Array<ArrayBuffer>|null;imagenKey?:string|null;imagenHash?:string|null} = body.quitarImagen ? {imagenContenido:null,imagenKey:null,imagenHash:null}:{};
    if(body.imagen){
      if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.imagen))throw new ApiError(400,'Usa una imagen PNG, JPG o WebP.');
      let bytes:Buffer;
      try {
        const input=Buffer.from(body.imagen.split(',')[1],'base64'); if(input.length>3000000)throw new Error('size');
        const source=sharp(input,{limitInputPixels:25000000});const info=await source.metadata();
        if(!['png','jpeg','webp'].includes(info.format||'')||(info.pages||1)>1)throw new Error('format');
        bytes=await source.rotate().resize(1000,1000,{fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:80}).toBuffer();
        if(bytes.length>786432)throw new Error('size');
      }catch{throw new ApiError(400,'No se pudo procesar la imagen. Usa PNG, JPG o WebP de hasta 3 MB y 25 megapíxeles.');}
      const hash=createHash('sha256').update(bytes).digest('hex');
      if(process.env.PHOTO_STORAGE==='r2'){
        const key=`tienda/${body.productoId}/${hash}.jpg`;let storage;
        try{storage=createR2Storage();await storage.put(key,bytes,hash);}catch{throw new ApiError(503,'No se pudo guardar la imagen. Intenta nuevamente.');}finally{storage?.close();}
        imageData={imagenContenido:null,imagenKey:key,imagenHash:hash};
      } else if(!process.env.PHOTO_STORAGE||process.env.PHOTO_STORAGE==='postgres'){imageData={imagenContenido:new Uint8Array(bytes),imagenKey:null,imagenHash:hash};}
      else throw new ApiError(503,'El almacenamiento de imágenes no está configurado.');
    }
    await prisma.$transaction(async tx=>{
      await tx.productoInventario.update({where:{id:body.productoId},data:{precioVenta:body.precio}});
      const data={descripcion:body.descripcion,publicado:body.publicado,destacado:body.destacado,...imageData};
      await tx.tiendaPublicacion.upsert({where:{productoId:body.productoId},create:{productoId:body.productoId,...data},update:data});
      await tx.auditoriaLog.create({data:{usuarioId:actor.id,modulo:'TIENDA',accion:'UPDATE',entidadTipo:'TiendaPublicacion',entidadId:body.productoId,valoresNuevos:{publicado:body.publicado,precio:body.precio,destacado:body.destacado}}});
    });
    return NextResponse.json({success:true});
  }catch(error){return apiError(error);}
}
