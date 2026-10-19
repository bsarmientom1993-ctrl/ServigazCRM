import { requireSession } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const productos = await prisma.productoInventario.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(productos);
  } catch (error: any) {
    if (error instanceof ApiError) return apiError(error);
    console.error("Error al obtener inventario:", error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error so UI never crashes
  }
}
