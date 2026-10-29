import {assignedRoleWhere} from '@/lib/auth';
import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const tecnicos = await prisma.usuario.findMany({
      where: {
        ...(session.rol === "ADMIN" ? {} : { sucursalId: session.sucursalId }),
        ...assignedRoleWhere("TECNICO_FIJO"),
        estado: "ACTIVO",
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
      },
    });
    return NextResponse.json(tecnicos);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    return NextResponse.json({ error: "Error al obtener técnicos" }, { status: 500 });
  }
}
