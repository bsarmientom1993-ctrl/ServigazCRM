import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, inventoryOperators } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { lockLocations, locationForOperation, lockProduct, takeStock, addStock, quantity } from "@/lib/inventory";

const relations = { producto: { select: { id: true, nombre: true, codigoSku: true, unidadMedida: true } },
  origen: { include: { sucursal: { select: { nombre: true } } } }, destino: { include: { sucursal: { select: { nombre: true } } } },
  enviadoPor: { select: { nombre: true } }, resueltoPor: { select: { nombre: true } } };
export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req, inventoryOperators);
    const traspasos = await prisma.traspasoInventario.findMany({
      where: user.rol === "ADMIN" ? {} : user.rol === "ENCARGADO_TIENDA" ? {OR:[{origen:{tipo:"TIENDA"}},{destino:{tipo:"TIENDA"}}]} : { OR: [{ origen: { sucursalId: user.sucursalId || "__ninguna__" } }, { destino: { sucursalId: user.sucursalId || "__ninguna__" } }] },
      include: relations, orderBy: { createdAt: "desc" }, take: 200,
    });
    return NextResponse.json({ traspasos });
  } catch (error) { return apiError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireSession(req, inventoryOperators);
    const id = z.string().uuid("Falta la clave del traspaso.").parse(req.headers.get("Idempotency-Key"));
    const data = z.object({ productoId: z.string().min(1), origenId: z.string().min(1), destinoId: z.string().min(1),
      cantidad: z.number().finite().positive(), observaciones: z.string().trim().max(1000).default("") }).parse(await req.json());
    if (data.origenId === data.destinoId) throw new ApiError(400, "Origen y destino deben ser diferentes.");
    const amount = quantity(data.cantidad);
    const result = await prisma.$transaction(async tx => {
      await lockLocations(tx, [data.origenId, data.destinoId]);
      const source = await locationForOperation(tx, user, data.origenId);
      const destination = await tx.ubicacionInventario.findUnique({ where: { id: data.destinoId }, include: { sucursal: true } });
      if (!destination?.activo || destination.esInicial || (destination.sucursal && !destination.sucursal.activo)) throw new ApiError(400, "Selecciona un destino activo.");
      if (user.rol === "ENCARGADO_TIENDA" && destination.tipo !== "TIENDA") throw new ApiError(403,"Selecciona otra tienda como destino.");
      const product = await lockProduct(tx, data.productoId);
      const previous = await tx.traspasoInventario.findUnique({ where: { id } });
      if (previous) {
        if (previous.productoId !== data.productoId || previous.origenId !== data.origenId || previous.destinoId !== data.destinoId ||
          !previous.cantidad.equals(amount) || previous.enviadoPorId !== user.id || (previous.observaciones || "") !== data.observaciones) throw new ApiError(409, "La clave ya se utilizó para otro traspaso.");
        return previous;
      }
      const balance = await takeStock(tx, product.id, source.id, amount);
      const transfer = await tx.traspasoInventario.create({ data: {
        id, productoId: product.id, origenId: source.id, destinoId: destination.id, cantidad: amount, costoUnitario: product.costoPromedio,
        enviadoPorId: user.id, observaciones: data.observaciones,
      } });
      await tx.movimientoInventario.create({ data: {
        productoId: product.id, tipoMovimiento: "TRASPASO", cantidad: amount, stockAnterior: balance.before, stockNuevo: balance.after,
        origenSucursalId: source.sucursalId, destinoSucursalId: destination.sucursalId, ubicacionOrigenId: source.id, ubicacionDestinoId: destination.id,
        traspasoId: id, evento: "ENVIO", costoUnitario: product.costoPromedio, usuarioId: user.id, observaciones: data.observaciones,
      } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "TRASPASOS", accion: "CREATE", entidadTipo: "TraspasoInventario", entidadId: id,
        valoresNuevos: { productoId: product.id, origenId: source.id, destinoId: destination.id, cantidad: String(amount), estado: "EN_TRANSITO" } } });
      return transfer;
    }, { timeout: 15000 });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireSession(req, inventoryOperators);
    const data = z.object({ id: z.string().uuid(), accion: z.enum(["RECIBIR", "CANCELAR"]), motivo: z.string().trim().max(1000).optional() }).parse(await req.json());
    if (data.accion === "CANCELAR" && (!data.motivo || data.motivo.length < 5)) throw new ApiError(400, "Describe el motivo y confirma que el material vuelve al origen.");
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "TraspasoInventario" WHERE id = ${data.id} FOR UPDATE`;
      if (!rows.length) throw new ApiError(404, "Traspaso no encontrado.");
      const transfer = await tx.traspasoInventario.findUniqueOrThrow({ where: { id: data.id } });
      await lockLocations(tx, [transfer.origenId, transfer.destinoId]);
      const targetId = data.accion === "RECIBIR" ? transfer.destinoId : transfer.origenId;
      const target = await locationForOperation(tx, user, targetId);
      const state = data.accion === "RECIBIR" ? "RECIBIDO" : "CANCELADO";
      if (transfer.estado === state) return transfer;
      if (transfer.estado !== "EN_TRANSITO") throw new ApiError(409, "El traspaso ya fue resuelto.");
      await lockProduct(tx, transfer.productoId);
      const balance = await addStock(tx, transfer.productoId, targetId, transfer.cantidad);
      const updated = await tx.traspasoInventario.update({ where: { id: transfer.id }, data: {
        estado: state, resueltoPorId: user.id, resueltoAt: new Date(), motivoCancelacion: data.accion === "CANCELAR" ? data.motivo : null,
      } });
      await tx.movimientoInventario.create({ data: { productoId: transfer.productoId, tipoMovimiento: "TRASPASO",
        cantidad: transfer.cantidad, stockAnterior: balance.before, stockNuevo: balance.after,
        ubicacionOrigenId: transfer.origenId, ubicacionDestinoId: transfer.destinoId, traspasoId: transfer.id,
        evento: data.accion === "RECIBIR" ? "RECEPCION" : "DEVOLUCION_ORIGEN", costoUnitario: transfer.costoUnitario, usuarioId: user.id,
        origenSucursalId: data.accion === "CANCELAR" ? null : undefined, destinoSucursalId: target.sucursalId, observaciones: data.motivo || null } });
      await tx.auditoriaLog.create({ data: { usuarioId: user.id, modulo: "TRASPASOS", accion: "UPDATE", entidadTipo: "TraspasoInventario", entidadId: transfer.id,
        valoresAnteriores: { estado: transfer.estado }, valoresNuevos: { estado: state, motivo: data.motivo || null } } });
      return updated;
    }, { timeout: 15000 });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
