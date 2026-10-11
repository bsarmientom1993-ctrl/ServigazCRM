import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("servigaz_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        telefono: true,
        estado: true,
        sucursal: { select: { id: true, nombre: true } },
      },
    });

    if (!user || user.estado !== "ACTIVO") {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        telefono: user.telefono,
        sucursal: user.sucursal?.nombre,
      },
    });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
