import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trabajo = await prisma.trabajo.findUnique({
      where: { id },
      include: {
        cliente: true,
        encargado: { select: { id: true, nombre: true, email: true, telefono: true } },
        tecnico: { select: { id: true, nombre: true, email: true, telefono: true } },
        visitas: {
          orderBy: { createdAt: "desc" },
          include: { tecnico: { select: { id: true, nombre: true } } },
        },
        cotizaciones: {
          orderBy: { numeroVersion: "desc" },
        },
        pagos: {
          orderBy: { fechaPago: "desc" },
        },
        materiales: {
          orderBy: { createdAt: "desc" },
        },
        egreso: true,
        garantia: true,
      },
    });

    if (!trabajo) {
      return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(trabajo);
  } catch (error: any) {
    console.error("Error al cargar trabajo:", error);
    return NextResponse.json({ error: "Error al cargar trabajo: " + error.message }, { status: 500 });
  }
}
