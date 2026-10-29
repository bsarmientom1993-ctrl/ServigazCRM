import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO", "VENTAS"]);
    const clientes = await prisma.cliente.findMany({
      where: session.rol === "ADMIN" ? {} : { sucursalId: session.sucursalId },
      orderBy: { nombreCompleto: "asc" },
      include: {
        _count: { select: { trabajos: true } },
      },
    });
    return NextResponse.json(clientes);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req, ["ADMIN", "ENCARGADO", "VENTAS"]);
    const body = await req.json();
    const { nombreCompleto, telefono, email, direccion, ubicacionMapsUrl } = body;

    const cliente = await prisma.cliente.create({
      data: {
        nombreCompleto,
        telefonos: [telefono],
        email,
        direccion,
        ubicacionMapsUrl,
        nivelFidelizacion: "NUEVO",
        sucursalId: session.sucursalId,
      },
    });

    return NextResponse.json(cliente);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
  }
}
