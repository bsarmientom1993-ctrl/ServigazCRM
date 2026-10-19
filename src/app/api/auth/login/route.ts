import { loginFailure } from "@/lib/login-failure";
import { z } from "zod";
import { jwtSecret } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";


export async function POST(req: NextRequest) {
  let stage: "REQUEST" | "ACCOUNT_LOOKUP" | "PASSWORD_CHECK" | "TOKEN_SIGNING" | "AUDIT" = "REQUEST";
  try {
    const { email, password } = z.object({
      email: z.string().trim().email().max(320),
      password: z.string().min(1).max(1000),
    }).parse(await req.json());

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña requeridos" },
        { status: 400 }
      );
    }

    stage = "ACCOUNT_LOOKUP";
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

    stage = "PASSWORD_CHECK";
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      stage = "AUDIT";
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

    stage = "TOKEN_SIGNING";
    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        sucursalId: user.sucursalId,
      },
      jwtSecret(),
      { expiresIn: "7d" }
    );

    stage = "AUDIT";
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
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    if (error instanceof ApiError || error instanceof z.ZodError || error instanceof SyntaxError) return apiError(error);
    const failure = loginFailure(error, stage);
    console.error("Login failure", { ...failure, name: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json(failure, { status: 503 });
  }
}
