import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const productos = await prisma.productoInventario.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error so UI never crashes
  }
}
