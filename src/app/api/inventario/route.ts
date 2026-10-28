import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, inventoryOperators } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { locationScope } from "@/lib/inventory";
import { cents } from "@/lib/workflow-policy";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req);
    const id = req.nextUrl.searchParams.get("ubicacionId");
    const scope = locationScope(user);
    if (id && !(await prisma.ubicacionInventario.findFirst({ where: { AND: [scope, { id, activo: true }] } }))) throw new ApiError(403, "Ubicación no autorizada.");
    const productos = await prisma.productoInventario.findMany({
      where: { activo: true }, orderBy: { nombre: "asc" },
      include: { existencias: { where: { ubicacion: { AND: [scope, { activo: true }] }, ...(id ? { ubicacionId: id } : {}) },
        include: { ubicacion: { select: { id: true, nombre: true, tipo: true } } } } },
    });
    const result = productos.map(product => ({
      ...product, stockGlobal: user.rol === "ADMIN" ? product.stockActual : undefined,
      stockActual: product.existencias.reduce((total, stock) => total + Number(stock.stockActual), 0),
      stockMinimo: id ? Number(product.existencias[0]?.stockMinimo || 0) : product.existencias.reduce((sum, item) => sum + Number(item.stockMinimo), 0),
      bajoMinimo: product.existencias.some(item => item.stockMinimo.gt(0) && item.stockActual.lte(item.stockMinimo)),
    }));
    // Keep the array contract used by the order detail and other existing clients.
    return NextResponse.json(user.rol === "TECNICO_FIJO" ? result.map(product => ({
      id: product.id, codigoSku: product.codigoSku, nombre: product.nombre, categoria: product.categoria,
      unidadMedida: product.unidadMedida, stockActual: product.stockActual,
    })) : result);
  } catch (error) { return apiError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, inventoryOperators);
    const data = z.object({ codigoSku: z.string().trim().min(1).max(80), nombre: z.string().trim().min(2).max(200),
      categoria: z.string().trim().min(1).max(100), unidadMedida: z.string().trim().min(1).max(30), precioVenta: z.number().finite().nonnegative() }).parse(await req.json());
    cents(data.precioVenta);
    const product = await prisma.$transaction(async tx => {
      const result = await tx.productoInventario.create({ data });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "INVENTARIO", accion: "CREATE", entidadTipo: "ProductoInventario", entidadId: result.id, valoresNuevos: data } });
      return result;
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) { return apiError(error); }
}
