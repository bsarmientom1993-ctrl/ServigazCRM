import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, managers } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { cents } from "@/lib/workflow-policy";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, managers);
    const compras = await prisma.movimientoInventario.findMany({
      where: { tipoMovimiento: "COMPRA", ...(session.rol === "ADMIN" ? {} : { usuarioId: session.id }) },
      include: {
        producto: { select: { id: true, codigoSku: true, nombre: true, categoria: true, unidadMedida: true, costoPromedio: true, stockActual: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      }, orderBy: { fecha: "desc" },
    });
    return NextResponse.json({ compras, totalComprasRegistradas: compras.length,
      totalInvertidoAprox: compras.reduce((sum, c) => sum + Number(c.cantidad) * Number(c.producto.costoPromedio), 0) });
  } catch (error) { return apiError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, managers);
    const body = z.object({
      productoId: z.string().min(1), cantidad: z.number().finite().positive().max(99999999.99),
      precioCompraUnitario: z.number().finite().positive(),
      proveedorNombre: z.string().trim().min(1).max(300), proveedorContacto: z.string().trim().max(300).optional(),
      numeroDocumento: z.string().trim().max(200).optional(), observaciones: z.string().trim().max(2000).optional(),
      registrarEgresoCaja: z.boolean().default(false),
    }).parse(await req.json());
    cents(body.precioCompraUnitario);
    const quantity = new Prisma.Decimal(body.cantidad);
    if (quantity.decimalPlaces() > 2) throw new ApiError(400, "La cantidad admite hasta dos decimales.");
    const unitPrice = new Prisma.Decimal(body.precioCompraUnitario);
    const result = await prisma.$transaction(async tx => {
      const found = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ProductoInventario" WHERE id = ${body.productoId} FOR UPDATE`;
      if (!found.length) throw new ApiError(404, "Producto no encontrado.");
      const product = await tx.productoInventario.findUniqueOrThrow({ where: { id: body.productoId } });
      if (!product.activo) throw new ApiError(409, "El producto está inactivo.");
      const stock = product.stockActual.add(quantity);
      const purchaseTotal = quantity.mul(unitPrice).toDecimalPlaces(2);
      const average = product.stockActual.mul(product.costoPromedio).add(quantity.mul(unitPrice)).div(stock).toDecimalPlaces(2);
      const producto = await tx.productoInventario.update({ where: { id: product.id }, data: { stockActual: stock, costoPromedio: average } });
      const movimiento = await tx.movimientoInventario.create({ data: {
        productoId: product.id, tipoMovimiento: "COMPRA", cantidad: quantity, stockAnterior: product.stockActual, stockNuevo: stock,
        proveedorNombre: body.proveedorNombre, proveedorContacto: body.proveedorContacto || null, usuarioId: user.id,
        observaciones: "Documento: " + (body.numeroDocumento || "S/N") + " · Costo unitario: " + unitPrice + " · " + (body.observaciones || ""),
      } });
      const egreso = body.registrarEgresoCaja ? await tx.egresoGeneralManual.create({ data: {
        categoria: "INVENTARIO_COMPRAS", monto: purchaseTotal, descripcion: "Compra de " + body.cantidad + " " + product.nombre,
        proveedorInfo: body.proveedorNombre, creadoPorId: user.id,
      } }) : null;
      await tx.auditoriaLog.create({ data: {
        usuarioId: user.id, modulo: "INVENTARIO_COMPRAS", accion: "CREATE", entidadTipo: "MovimientoInventario", entidadId: movimiento.id,
        valoresNuevos: { productoId: product.id, cantidad: String(quantity), precioCompraUnitario: String(unitPrice), monto: String(purchaseTotal), egresoId: egreso?.id || null },
      } });
      return { success: true, producto, movimiento, egreso, resumen: { stockNuevo: Number(stock), nuevoCostoPromedio: Number(average), totalCompra: Number(purchaseTotal) } };
    }, { timeout: 15000 });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
