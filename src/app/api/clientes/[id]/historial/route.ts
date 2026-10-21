import { NextRequest, NextResponse } from "next/server";
import { requireSession, managers, workScope } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(req, managers); const { id } = await params;
    const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nombreCompleto: true, telefonos: true, direccion: true, email: true, sucursalId: true } });
    if (!cliente) throw new ApiError(404, "Cliente no encontrado.");
    if (user.rol !== "ADMIN" && cliente.sucursalId !== user.sucursalId) throw new ApiError(403, "Este cliente no pertenece a tu sucursal.");
    const where = { AND: [workScope(user), { clienteId: id }] };
    const cursor = req.nextUrl.searchParams.get("cursor");
    if (cursor && !await prisma.trabajo.findFirst({ where: { AND: [where, { id: cursor }] }, select: { id: true } })) throw new ApiError(400, "Actualiza el historial para continuar.");
    const trabajos = await prisma.trabajo.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, codigoCorrelativo: true, subtipoNombre: true, subtipoCodigo: true, estado: true, createdAt: true,
        cotizaciones: { orderBy: { numeroVersion: "desc" }, take: 1, select: { id: true, numeroVersion: true, totalCotizado: true, estado: true, fechaEmision: true, fechaVencimiento: true } },
        pagos: { select: { monto: true } }, egreso: { select: { id: true } },
      },
    });
    const page = trabajos.slice(0, 20);
    return NextResponse.json({ cliente, trabajos: page, siguiente: trabajos.length > 20 ? page[page.length - 1].id : null });
  } catch (error) { return apiError(error); }
}
