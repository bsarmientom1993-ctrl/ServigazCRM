import {z} from "zod";
import {CategoriaEgreso} from "@prisma/client";
import {createHash} from "node:crypto";
import {cents,money} from "@/lib/workflow-policy";
import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// GET /api/finanzas — Listar egresos generales con regla de privacidad #91
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO", "CAJA"]);
    const userId = session.id;
    const userRole = session.rol;

    // Regla #91: Admin ve todos los egresos; Encargado ve solo los creados por él
    const whereClause: any = {};
    if (userRole !== "ADMIN" && userId) {
      whereClause.creadoPorId = userId;
    }

    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria");
    const esRecurrente = searchParams.get("esRecurrente");

    if (categoria) whereClause.categoria = categoria;
    if (esRecurrente !== null && esRecurrente !== undefined) {
      whereClause.esRecurrente = esRecurrente === "true";
    }

    const egresos = await prisma.egresoGeneralManual.findMany({
      where: whereClause,
      include: {
        creadoPor: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
      },
      orderBy: { fechaEgreso: "desc" },
    });

    // Calcular totales por categoría
    const totalEgresos = egresos.reduce((acc, e) => acc + Number(e.monto), 0);
    const porCategoria = egresos.reduce((acc: any, e) => {
      acc[e.categoria] = (acc[e.categoria] || 0) + Number(e.monto);
      return acc;
    }, {});

    return NextResponse.json({
      egresos,
      totalEgresos,
      porCategoria,
      totalRegistros: egresos.length,
    });
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al listar egresos:", error);
    return NextResponse.json({ error: "Error al consultar egresos" }, { status: 500 });
  }
}

// POST /api/finanzas — Registrar nuevo egreso general
export async function POST(req:NextRequest){try{
 const session=await requireSession(req,["ADMIN","ENCARGADO","CAJA"]);
 const key=z.string().uuid().optional().parse(req.headers.get('Idempotency-Key')||undefined);if(session.rol==='CAJA'&&!key)throw new ApiError(400,'Falta la clave del egreso para evitar duplicados.');
 const body=z.object({categoria:z.nativeEnum(CategoriaEgreso).default('OTROS'),monto:z.number().finite().positive(),descripcion:z.string().trim().min(1).max(3000),proveedorInfo:z.string().trim().max(500).nullish(),comprobanteUrl:z.string().url().max(2000).or(z.literal('')).nullish(),esRecurrente:z.boolean().default(false),fechaEgreso:z.string().max(40).refine(v=>!v||Number.isFinite(new Date(v).getTime()),'Revisa la fecha.').optional()}).parse(await req.json());
 const amount=cents(body.monto);const fingerprint=createHash('sha256').update(session.id+JSON.stringify(body)).digest('hex');
 const egreso=await prisma.$transaction(async tx=>{
  if(key){await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key},0))`;const previous=await tx.egresoGeneralManual.findUnique({where:{id:key}});if(previous){const log=await tx.auditoriaLog.findFirst({where:{modulo:'FINANZAS',entidadId:key,usuarioId:session.id}});if(previous.creadoPorId!==session.id||(log?.valoresNuevos as any)?.huella!==fingerprint)throw new ApiError(409,'La clave se usó con otro egreso.');return previous;}}
  const row=await tx.egresoGeneralManual.create({data:{...(key?{id:key}:{}),categoria:body.categoria,monto:money(amount),descripcion:body.descripcion,proveedorInfo:body.proveedorInfo||null,comprobanteUrl:body.comprobanteUrl||null,esRecurrente:body.esRecurrente,fechaEgreso:body.fechaEgreso?new Date(body.fechaEgreso):new Date(),creadoPorId:session.id}});
  const actor=await tx.usuario.findUniqueOrThrow({where:{id:session.id},select:{nombre:true}});await tx.auditoriaLog.create({data:{usuarioId:session.id,modulo:'FINANZAS',accion:'CREATE',entidadTipo:'EgresoGeneralManual',entidadId:row.id,valoresNuevos:{categoria:row.categoria,monto:body.monto,descripcion:row.descripcion,realizadoPor:actor.nombre,huella:fingerprint}}});return row;
 });return NextResponse.json({success:true,egreso},{status:201});
}catch(e){return apiError(e);}}
