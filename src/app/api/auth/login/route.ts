import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "servigaz-secret-key-2026";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.usuario.findUnique({
      where: { email },
      include: { sucursal: true },
    });

    if (!user || user.estado !== "ACTIVO") {
      return NextResponse.json(
        { error: "Credenciales inválidas o usuario inactivo" },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Registrar en auditoría intento inválido
      await prisma.auditoriaLog.create({
        data: {
          usuarioId: user.id,
          modulo: "AUTENTICACION",
          accion: "INTENTO_INVALIDO",
          entidadTipo: "Usuario",
          entidadId: user.id,
          valoresNuevos: { email, motivo: "Password incorrecta" },
        },
      });

      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        sucursalId: user.sucursalId,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Auditoría de login exitoso
    await prisma.auditoriaLog.create({
      data: {
        usuarioId: user.id,
        modulo: "AUTENTICACION",
        accion: "LOGIN",
        entidadTipo: "Usuario",
        entidadId: user.id,
        valoresNuevos: { email },
      },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        telefono: user.telefono,
        sucursal: user.sucursal?.nombre,
      },
    });

    response.cookies.set("servigaz_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    let errorMsg = "Error interno del servidor";
    if (error?.code === "P2021" || error?.message?.includes("does not exist")) {
      errorMsg = "La base de datos en la nube está vacía (tablas no creadas). Ejecuta npx prisma db push.";
    } else if (error?.code === "P1001" || error?.message?.includes("Can't reach database server")) {
      errorMsg = "No se puede conectar al servidor de base de datos. Verifica DATABASE_URL.";
    }
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
