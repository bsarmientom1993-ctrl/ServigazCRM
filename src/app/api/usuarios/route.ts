import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rolesOf } from '@/lib/user-roles';
export async function GET(req: NextRequest) {
  try {
    await requireSession(req, ["ADMIN"]);
    const users = await prisma.usuario.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, email: true, telefono: true, rol: true, rolesAsignados:true, estado: true, sucursal: { select: { nombre: true } } } });
    return NextResponse.json(users.map(({rolesAsignados,...u})=>({...u,roles:rolesOf({...u,rolesAsignados})})));
  } catch (error) { return apiError(error); }
}
