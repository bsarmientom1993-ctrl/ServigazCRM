import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const certificados = await prisma.certificadoGarantia.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        trabajo: {
          include: {
            cliente: true,
            tecnico: { select: { id: true, nombre: true, email: true } },
          },
        },
      },
    });

    const reclamos = await prisma.reclamoGarantia.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        trabajoOriginal: {
          include: {
            cliente: true,
          },
        },
        tecnicoAsignado: {
          select: { id: true, nombre: true, email: true },
        },
      },
    });

    return NextResponse.json({ certificados, reclamos });
  } catch (error: any) {
    console.error("Error al obtener garantías:", error);
    return NextResponse.json({ error: "Error al cargar garantías: " + error.message }, { status: 500 });
  }
}
