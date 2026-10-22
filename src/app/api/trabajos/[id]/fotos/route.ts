import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sharp, { type OutputInfo } from "sharp";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { photoPermissions, photoWorkSelect, photoMetadataSelect, photoStages, photoLimit, photoUrl } from "@/lib/work-photos";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req), { id } = await params;
    const work = await prisma.trabajo.findUnique({ where: { id }, select: photoWorkSelect });
    if (!work) throw new ApiError(404, "Trabajo no encontrado.");
    const permisos = photoPermissions(user,work);
    const photos = await prisma.fotoTrabajo.findMany({ where: { trabajoId: id }, select: photoMetadataSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return NextResponse.json({ trabajo: { id, codigo: work.codigoCorrelativo, cliente: work.cliente.nombreCompleto }, permisos, fotos: photos.map(photo=>({...photo,url:photoUrl(id,photo.id)})) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch(error) { return apiError(error); }
}
async function boundedForm(req: NextRequest) {
  const maximum = 2200000;
  if (Number(req.headers.get("content-length") || 0) > maximum) throw new ApiError(413,"La foto es demasiado grande. Intenta una imagen más pequeña.");
  const reader = req.body?.getReader(); if (!reader) throw new ApiError(400,"Selecciona una fotografía.");
  const chunks: Uint8Array[]=[]; let size=0;
  while(true) { const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new ApiError(413,"La foto supera el tamaño admitido.");}chunks.push(value); }
  try { return await new Response(Buffer.concat(chunks), {headers:{"Content-Type":req.headers.get("content-type") || ""}}).formData(); } catch { throw new ApiError(400,"El archivo enviado no es válido."); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req), { id } = await params;
    const work = await prisma.trabajo.findUnique({ where: { id }, select: photoWorkSelect });
    if (!work) throw new ApiError(404,"Trabajo no encontrado.");
    photoPermissions(user,work);
    const key=z.string().uuid().parse(req.headers.get("Idempotency-Key"));
    if (!/^multipart\/form-data;/i.test(req.headers.get("content-type") || "")) throw new ApiError(400,"Envía la foto desde la cámara o galería.");
    const form=await boundedForm(req), etapa=z.enum(photoStages).parse(form.get("etapa")), descripcion=z.string().trim().max(500).parse(form.get("descripcion") || "");
    if (!photoPermissions(user,work)[etapa]) throw new ApiError(409,etapa==="FINAL"?"Las fotos finales se habilitan cuando el cliente acepta la propuesta.":"Las fotos iniciales corresponden a la evaluación anterior a la aceptación.");
    const file=form.get("foto"); if(!file || typeof file==="string" || file.size<1 || file.size>2097152)throw new ApiError(400,"Selecciona una foto de hasta 2 MB.");
    let image: { data: Buffer; info: OutputInfo };
    try {
      const input=Buffer.from(await file.arrayBuffer());
      const raster = input.subarray(0,3).equals(Buffer.from([255,216,255])) || input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || input.subarray(0,4).toString()==="RIFF" && input.subarray(8,12).toString()==="WEBP";
      if(!raster)throw new Error("format");
      const metadata=await sharp(input,{limitInputPixels:25000000}).metadata();
      if(!["jpeg","png","webp"].includes(metadata.format || ""))throw new Error("format");
      image=await sharp(input,{limitInputPixels:25000000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).jpeg({quality:80}).toBuffer({resolveWithObject:true});
    } catch { throw new ApiError(400,"No se pudo leer la foto. Selecciona una imagen JPG, PNG o WebP válida."); }
    if(image.data.byteLength>786432)throw new ApiError(413,"La imagen tiene demasiado detalle para guardarse. Intenta una foto más pequeña.");
    const hash=createHash("sha256").update(image.data).digest("hex");
    const photo=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Trabajo" WHERE id = ${id} FOR UPDATE`;
      const current=await tx.trabajo.findUniqueOrThrow({where:{id},select:photoWorkSelect});
      if(!photoPermissions(user,current)[etapa])throw new ApiError(409,"La etapa del trabajo cambió. Actualiza la carpeta antes de subir la foto.");
      const prior=await tx.fotoTrabajo.findUnique({where:{id:key},select:{...photoMetadataSelect,autorId:true,sha256:true}});
      if(prior){if(prior.trabajoId!==id || prior.autorId!==user.id || prior.etapa!==etapa || prior.sha256!==hash || prior.descripcion!==descripcion)throw new ApiError(409,"Esta solicitud corresponde a otra fotografía.");const {autorId,sha256,...metadata}=prior;return metadata;}
      const duplicate=await tx.fotoTrabajo.findUnique({where:{trabajoId_etapa_sha256:{trabajoId:id,etapa,sha256:hash}},select:photoMetadataSelect});if(duplicate)return duplicate;
      if(await tx.fotoTrabajo.count({where:{trabajoId:id,etapa}})>=photoLimit)throw new ApiError(409,"La carpeta ya alcanzó el límite de "+photoLimit+" fotos para esta etapa.");
      const actor=await tx.usuario.findUniqueOrThrow({where:{id:user.id},select:{nombre:true}});
      const saved=await tx.fotoTrabajo.create({data:{id:key,trabajoId:id,autorId:user.id,autorNombre:actor.nombre,etapa,descripcion,contenido:new Uint8Array(image.data),sha256:hash,ancho:image.info.width,alto:image.info.height},select:photoMetadataSelect});
      await tx.auditoriaLog.create({data:{usuarioId:user.id,modulo:"FOTOS_TRABAJO",accion:"CREATE",entidadTipo:"FotoTrabajo",entidadId:saved.id,valoresNuevos:{trabajoId:id,etapa,realizadoPor:actor.nombre,descripcion}}});
      return saved;
    });
    return NextResponse.json({...photo,url:photoUrl(id,photo.id)},{status:201});
  }catch(error){return apiError(error);}
}
