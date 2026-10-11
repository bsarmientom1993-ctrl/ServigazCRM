import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nombreCompleto: "asc" },
      include: {
        _count: { select: { trabajos: true } },
      },
    });
    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      },
    });

    return NextResponse.json(cliente);
  } catch (error) {
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
  }
}
