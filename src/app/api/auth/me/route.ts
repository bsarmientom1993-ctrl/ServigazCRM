import { updateProfile } from "@/lib/user-profile";
import { jwtSecret, requireSession } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";
import { activeRole, rolesOf } from '@/lib/user-roles';


export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("servigaz_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const decoded = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] }) as any;
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        rolesAsignados:true,
        telefono: true,
        estado: true,
        sucursal: { select: { id: true, nombre: true } },
      },
    });

    if (!user || user.estado !== "ACTIVO") {
      return NextResponse.json({ user: null });
    }
    const rol=activeRole(user,req.cookies.get('servigaz_rol')?.value);
    if(!rol)return NextResponse.json({user:null});

    return NextResponse.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol,roles:rolesOf(user),
        telefono: user.telefono,
        sucursal: user.sucursal?.nombre,
        sucursalId: user.sucursal?.id || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}


export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession(req);
    return NextResponse.json({ user: await updateProfile(session, session.id, await req.json()) });
  } catch (error) { return apiError(error); }
}
