import { createHash } from "node:crypto";
import { lockLocations, locationForOperation, lockProduct, addStock } from "@/lib/inventory";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, inventoryOperators } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { cents } from "@/lib/workflow-policy";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req, inventoryOperators);
    const compras = await prisma.movimientoInventario.findMany({
      where: { tipoMovimiento: "COMPRA", ...(session.rol === "ADMIN" ? {} : session.rol === "ALMACENERO" ? {ubicacionDestino:{tipo:"ALMACEN",OR:[{sucursalId:null},{sucursalId:session.sucursalId||"__ninguna__"}]}} : session.rol === "ENCARGADO_TIENDA" ? {ubicacionDestino:{tipo:"TIENDA"}} : { OR: [{ ubicacionDestino: { sucursalId: session.sucursalId || "__ninguna__" } }, { ubicacionDestinoId: null, usuarioId: session.id }] }) },
      include: {
        ubicacionDestino: { select: { nombre: true } },
        producto: { select: { id: true, codigoSku: true, nombre: true, categoria: true, unidadMedida: true, costoPromedio: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      }, orderBy: { fecha: "desc" },
    });
    return NextResponse.json({ compras, totalComprasRegistradas: compras.length,
      totalInvertidoAprox: compras.reduce((sum, c) => sum + Number(c.cantidad) * Number(c.costoUnitario ?? c.producto.costoPromedio), 0) });
  } catch (error) { return apiError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, inventoryOperators);
    const requestId = z.string().uuid("Falta la clave de compra.").parse(req.headers.get("Idempotency-Key"));
    const body = z.object({
      ubicacionId: z.string().min(1),
      productoId: z.string().min(1), cantidad: z.number().finite().positive().max(99999999.99),
      precioCompraUnitario: z.number().finite().positive(),
      proveedorNombre: z.string().trim().min(1).max(300), proveedorContacto: z.string().trim().max(300).optional(),
      numeroDocumento: z.string().trim().max(200).optional(), observaciones: z.string().trim().max(2000).optional(),
      registrarEgresoCaja: z.boolean().default(false),
    }).parse(await req.json());
    if(["ENCARGADO_TIENDA","ALMACENERO"].includes(user.rol) && body.registrarEgresoCaja) throw new ApiError(403,"Puedes ingresar compras al inventario; el registro de caja corresponde al administrador o encargado.");
    cents(body.precioCompraUnitario);
    const quantity = new Prisma.Decimal(body.cantidad);
    if (quantity.decimalPlaces() > 2) throw new ApiError(400, "La cantidad admite hasta dos decimales.");
    const unitPrice = new Prisma.Decimal(body.precioCompraUnitario);
    const fingerprint = createHash("sha256").update(user.id + JSON.stringify(body)).digest("hex");
    const result = await prisma.$transaction(async tx => {
      await lockLocations(tx, [body.ubicacionId]);
      const location = await locationForOperation(tx, user, body.ubicacionId);
      if (location.esInicial) throw new ApiError(400, "Selecciona un almacén o tienda operativa para recibir compras.");
      const product = await lockProduct(tx, body.productoId);
      const previous = await tx.movimientoInventario.findUnique({ where: { id: requestId } });
      if (previous) {
        if (previous.huellaOperacion !== fingerprint || previous.productoId !== body.productoId || previous.ubicacionDestinoId !== body.ubicacionId ||
          !previous.cantidad.equals(quantity) || !previous.costoUnitario?.equals(unitPrice) || previous.usuarioId !== user.id ||
          previous.proveedorNombre !== body.proveedorNombre) throw new ApiError(409, "La clave ya se utilizó en otra compra.");
        const balance = await tx.existenciaInventario.findUniqueOrThrow({ where: { productoId_ubicacionId: { productoId: product.id, ubicacionId: location.id } } });
        return { success: true, yaRegistrada: true, resumen: { stockNuevo: Number(balance.stockActual), nuevoCostoPromedio: Number(product.costoPromedio), totalCompra: Number(quantity.mul(unitPrice)) } };
      }
      const balance = await addStock(tx, product.id, location.id, quantity);
      const stock = product.stockActual.add(quantity);
      const purchaseTotal = quantity.mul(unitPrice).toDecimalPlaces(2);
      const average = product.stockActual.mul(product.costoPromedio).add(quantity.mul(unitPrice)).div(stock).toDecimalPlaces(2);
      const producto = await tx.productoInventario.update({ where: { id: product.id }, data: { stockActual: stock, costoPromedio: average } });
      const movimiento = await tx.movimientoInventario.create({ data: {
        id: requestId, huellaOperacion: fingerprint, productoId: product.id, tipoMovimiento: "COMPRA", cantidad: quantity, stockAnterior: balance.before, stockNuevo: balance.after,
        ubicacionDestinoId: location.id, destinoSucursalId: location.sucursalId, evento: "COMPRA", costoUnitario: unitPrice,
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
      return { success: true, producto, movimiento, egreso, resumen: { stockNuevo: Number(balance.after), nuevoCostoPromedio: Number(average), totalCompra: Number(purchaseTotal) } };
    }, { timeout: 15000 });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
