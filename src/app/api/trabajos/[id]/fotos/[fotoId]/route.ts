import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { photoPermissions, photoWorkSelect } from "@/lib/work-photos";
export const runtime="nodejs";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string;fotoId:string}>}){
  try{
    const user=await requireSession(req),{id,fotoId}=await params;
    const work=await prisma.trabajo.findUnique({where:{id},select:photoWorkSelect});if(!work)throw new ApiError(404,"Trabajo no encontrado.");photoPermissions(user,work);
    const photo=await prisma.fotoTrabajo.findFirst({where:{id:fotoId,trabajoId:id},select:{contenido:true,etapa:true}});if(!photo)throw new ApiError(404,"Foto no encontrada.");
    const content=req.nextUrl.searchParams.get("mini")==="1"?await sharp(Buffer.from(photo.contenido)).resize({width:360,height:360,fit:"inside",withoutEnlargement:true}).jpeg({quality:75}).toBuffer():Buffer.from(photo.contenido);
    return new NextResponse(new Uint8Array(content),{headers:{"Content-Type":"image/jpeg","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin","Cache-Control":"private, no-store","Content-Disposition":(req.nextUrl.searchParams.get("descargar")==="1"?"attachment":"inline")+'; filename="'+photo.etapa.toLowerCase()+'.jpg"'}});
  }catch(error){return apiError(error);}
}
