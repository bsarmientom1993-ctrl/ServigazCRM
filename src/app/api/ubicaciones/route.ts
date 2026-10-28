import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, inventoryOperators } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { locationScope } from "@/lib/inventory";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req);
    const directory = req.nextUrl.searchParams.get("directorio") === "1";
    if (directory && !inventoryOperators.includes(user.rol)) throw new ApiError(403, "No tienes permiso para consultar el directorio.");
    const inactive = req.nextUrl.searchParams.get("incluirInactivas") === "1";
    if (inactive && user.rol !== "ADMIN") throw new ApiError(403, "Solo el administrador puede consultar ubicaciones inactivas.");
    const ubicaciones = await prisma.ubicacionInventario.findMany({
      where: { ...(directory && user.rol !== "ENCARGADO_TIENDA" ? { esInicial: false } : locationScope(user)), ...(inactive && !directory ? {} : { activo: true, OR: [{ sucursalId: null }, { sucursal: { activo: true } }] }) },
      select: { id: true, nombre: true, tipo: true, sucursalId: true, direccion: true, esInicial: true, activo: true,
        sucursal: { select: { id: true, nombre: true } } },
      orderBy: [{ esInicial: "desc" }, { nombre: "asc" }],
    });
    return NextResponse.json({ ubicaciones });
  } catch (error) { return apiError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, ["ADMIN"]);
    const data = z.object({ nombre: z.string().trim().min(2).max(150), tipo: z.enum(["ALMACEN", "TIENDA"]),
      sucursalId: z.string().min(1).nullish(), direccion: z.string().trim().max(500).optional() }).parse(await req.json());
    if (data.tipo === "TIENDA" && !data.sucursalId) throw new ApiError(400, "La tienda debe pertenecer a una sucursal.");
    const result = await prisma.$transaction(async tx => {
      if (data.sucursalId) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Sucursal" WHERE id = ${data.sucursalId} FOR SHARE`);
      if (data.sucursalId && !(await tx.sucursal.findFirst({ where: { id: data.sucursalId, activo: true } }))) throw new ApiError(400, "Selecciona una sucursal activa.");
      const ubicacion = await tx.ubicacionInventario.create({ data: { ...data, sucursalId: data.sucursalId || null } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "UBICACIONES", accion: "CREATE", entidadTipo: "UbicacionInventario", entidadId: ubicacion.id, valoresNuevos: data } });
      return ubicacion;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiError(error); }
}
