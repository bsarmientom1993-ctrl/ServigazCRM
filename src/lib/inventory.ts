import { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import { Session } from "./auth";

export const locationScope = (user: Session): Prisma.UbicacionInventarioWhereInput =>
  user.rol === "ADMIN" ? {} : { sucursalId: user.sucursalId || "__sin_sucursal__", esInicial: false };

export function assertLocationAccess(user: Session, location: { sucursalId: string | null; esInicial: boolean }) {
  if (user.rol === "ADMIN") return;
  if (!location.esInicial && user.sucursalId && location.sucursalId === user.sucursalId) return;
  throw new ApiError(403, "Solo puedes operar el inventario de tu sucursal.");
}
export async function lockLocations(tx: Prisma.TransactionClient, ids: string[]) {
  const keys = [...new Set(ids)].sort();
  if (!keys.length) throw new ApiError(400, "Selecciona una ubicación.");
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "UbicacionInventario" WHERE id IN (${Prisma.join(keys)}) ORDER BY id FOR SHARE`);
}
export async function locationForOperation(tx: Prisma.TransactionClient, user: Session, id: string) {
  const location = await tx.ubicacionInventario.findUnique({ where: { id }, include: { sucursal: true } });
  if (!location || !location.activo || (location.sucursal && !location.sucursal.activo)) throw new ApiError(409, "La ubicación está inactiva o no existe.");
  assertLocationAccess(user, location);
  return location;
}
export async function lockProduct(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ProductoInventario" WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new ApiError(404, "Producto no encontrado.");
  const product = await tx.productoInventario.findUniqueOrThrow({ where: { id } });
  if (!product.activo) throw new ApiError(409, "El producto está inactivo.");
  const stocks = await tx.existenciaInventario.aggregate({ where: { productoId: id }, _sum: { stockActual: true } });
  const transit = await tx.traspasoInventario.aggregate({ where: { productoId: id, estado: "EN_TRANSITO" }, _sum: { cantidad: true } });
  const total = new Prisma.Decimal(stocks._sum.stockActual || 0).add(transit._sum.cantidad || 0);
  if (!product.stockActual.equals(total)) throw new ApiError(409, "El stock global y las ubicaciones requieren conciliación. Contacta al administrador.");
  return product;
}
export async function stockRow(tx: Prisma.TransactionClient, productId: string, locationId: string) {
  return tx.existenciaInventario.upsert({
    where: { productoId_ubicacionId: { productoId: productId, ubicacionId: locationId } },
    create: { productoId: productId, ubicacionId: locationId }, update: {},
  });
}
export function quantity(value: number) {
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || result.lte(0) || result.gt("99999999.99") || result.decimalPlaces() > 2) throw new ApiError(400, "La cantidad debe ser positiva y tener hasta dos decimales.");
  return result;
}
export async function takeStock(tx: Prisma.TransactionClient, productId: string, locationId: string, amount: Prisma.Decimal) {
  const row = await stockRow(tx, productId, locationId);
  const changed = await tx.existenciaInventario.updateMany({
    where: { id: row.id, stockActual: { gte: amount } }, data: { stockActual: { decrement: amount } },
  });
  if (changed.count !== 1) throw new ApiError(409, "Stock insuficiente en la ubicación seleccionada.");
  return { before: row.stockActual, after: row.stockActual.sub(amount) };
}
export async function addStock(tx: Prisma.TransactionClient, productId: string, locationId: string, amount: Prisma.Decimal) {
  const row = await stockRow(tx, productId, locationId);
  await tx.existenciaInventario.update({ where: { id: row.id }, data: { stockActual: { increment: amount } } });
  return { before: row.stockActual, after: row.stockActual.add(amount) };
}
