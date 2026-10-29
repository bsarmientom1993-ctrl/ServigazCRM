import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { photoPermissions, photoWorkSelect } from "@/lib/work-photos";
import { readPhoto } from "@/lib/photo-storage";
export const runtime="nodejs";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string;fotoId:string}>}){
  try{
    const user=await requireSession(req),{id,fotoId}=await params;
    const work=await prisma.trabajo.findUnique({where:{id},select:photoWorkSelect});if(!work)throw new ApiError(404,"Trabajo no encontrado.");photoPermissions(user,work);
    const photo=await prisma.fotoTrabajo.findFirst({where:{id:fotoId,trabajoId:id},select:{contenido:true,objectKey:true,sha256:true,etapa:true}});if(!photo)throw new ApiError(404,"Foto no encontrada.");
    if(user.rol==='VENTAS'&&photo.etapa!=='INICIAL')throw new ApiError(403,'Tu rol permite consultar las fotos de recepción inicial.');
    const bytes=await readPhoto(photo);
    const content=req.nextUrl.searchParams.get("mini")==="1"?await sharp(bytes).resize({width:360,height:360,fit:"inside",withoutEnlargement:true}).jpeg({quality:75}).toBuffer():bytes;
    return new NextResponse(new Uint8Array(content),{headers:{"Content-Type":"image/jpeg","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin","Cache-Control":"private, no-store","Content-Disposition":(req.nextUrl.searchParams.get("descargar")==="1"?"attachment":"inline")+'; filename="'+photo.etapa.toLowerCase()+'.jpg"'}});
  }catch(error){return apiError(error);}
}
