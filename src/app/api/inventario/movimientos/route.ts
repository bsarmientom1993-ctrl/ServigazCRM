import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, managers } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireSession(req, managers);
    const id = req.nextUrl.searchParams.get("ubicacionId");
    const movements = await prisma.movimientoInventario.findMany({
      where: { AND: [
        user.rol === "ADMIN" ? {} : { OR: [
          { ubicacionOrigen: { sucursalId: user.sucursalId || "__ninguna__" } },
          { ubicacionDestino: { sucursalId: user.sucursalId || "__ninguna__" } },
          { ubicacionOrigenId: null, ubicacionDestinoId: null, usuarioId: user.id },
        ] },
        id ? { OR: [{ ubicacionOrigenId: id }, { ubicacionDestinoId: id }] } : {},
      ] },
      include: { producto: { select: { nombre: true, codigoSku: true } }, usuario: { select: { nombre: true } },
        ubicacionOrigen: { select: { nombre: true, sucursalId: true } }, ubicacionDestino: { select: { nombre: true, sucursalId: true } } },
      orderBy: { fecha: "desc" }, take: 200,
    });
    return NextResponse.json({ movimientos: movements.map(m => {
      const location = m.evento === "RECEPCION" || m.evento === "COMPRA" ? m.ubicacionDestino : m.ubicacionOrigen;
      const visible = user.rol === "ADMIN" || (location && location.sucursalId === user.sucursalId && !!user.sucursalId) || (!m.ubicacionOrigenId && !m.ubicacionDestinoId && m.usuarioId === user.id);
      return { ...m, stockAnterior: visible ? m.stockAnterior : null, stockNuevo: visible ? m.stockNuevo : null };
    }) });
  } catch (error) { return apiError(error); }
}
