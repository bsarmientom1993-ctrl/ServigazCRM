import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, managers } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req, managers);
    const sucursales = await prisma.sucursal.findMany({ where: user.rol === "ADMIN" ? {} : { id: user.sucursalId || "__ninguna__" },
      include: { ubicaciones: { select: { id: true, nombre: true, tipo: true, activo: true } }, usuarios: { select: { id: true, nombre: true, rol: true, estado: true } } },
      orderBy: { nombre: "asc" } });
    const usuarios = user.rol === "ADMIN" ? await prisma.usuario.findMany({ select: { id: true, nombre: true, rol: true, sucursalId: true, estado: true }, orderBy: { nombre: "asc" } }) : [];
    return NextResponse.json({ sucursales, usuarios });
  } catch (error) { return apiError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, ["ADMIN"]);
    const data = z.object({ nombre: z.string().trim().min(2).max(150), direccion: z.string().trim().max(500).optional(), telefono: z.string().trim().max(40).optional() }).parse(await req.json());
    const branch = await prisma.$transaction(async tx => {
      const result = await tx.sucursal.create({ data });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "SUCURSALES", accion: "CREATE", entidadTipo: "Sucursal", entidadId: result.id, valoresNuevos: data } });
      return result;
    });
    return NextResponse.json(branch, { status: 201 });
  } catch (error) { return apiError(error); }
}
