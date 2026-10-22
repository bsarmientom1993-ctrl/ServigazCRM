import { NextRequest,NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { photoWorkScope,photoWorkSelect } from "@/lib/work-photos";
export async function GET(req:NextRequest){try{const user=await requireSession(req);const works=await prisma.trabajo.findMany({where:photoWorkScope(user),select:{...photoWorkSelect,_count:{select:{fotosRegistro:true}}},orderBy:{updatedAt:"desc"}});return NextResponse.json(works.map(work=>({id:work.id,codigo:work.codigoCorrelativo,cliente:work.cliente.nombreCompleto,estado:work.estado,fotos:work._count.fotosRegistro})));}catch(error){return apiError(error);}}
