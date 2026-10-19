import { requireSession, workScope } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO"]);
    const certificados = await prisma.certificadoGarantia.findMany({
      where: { trabajo: workScope(session) },
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
      where: { trabajoOriginal: workScope(session) },
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
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al obtener garantías:", error);
    return NextResponse.json({ error: "Error al cargar garantías: " + error.message }, { status: 500 });
  }
}
