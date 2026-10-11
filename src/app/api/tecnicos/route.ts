import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tecnicos = await prisma.usuario.findMany({
      where: {
        rol: "TECNICO_FIJO",
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
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener técnicos" }, { status: 500 });
  }
}
