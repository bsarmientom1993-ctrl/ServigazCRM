import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Verificar si ya existen usuarios
    const count = await prisma.usuario.count().catch(() => null);

    // 2. Sucursal Principal
    const sucursalCentral = await prisma.sucursal.upsert({
      where: { id: "sucursal-central-01" },
      update: {},
      create: {
        id: "sucursal-central-01",
        nombre: "Sucursal Central & Taller Servigaz",
        direccion: "Av. Ballivián #450, Calacoto, La Paz",
        telefono: "+591 2 2784512",
        activo: true,
      },
    });

    // 3. Crear o actualizar usuarios
    const passwordHash = await bcrypt.hash("Admin123!", 10);
    const passwordTechHash = await bcrypt.hash("Tecnico123!", 10);

    const admin = await prisma.usuario.upsert({
      where: { email: "admin@servigaz.cl" },
      update: { passwordHash, estado: "ACTIVO" },
      create: {
        nombre: "Administrador General",
        email: "admin@servigaz.cl",
        passwordHash,
        telefono: "+591 71523411",
        rol: "ADMIN",
        estado: "ACTIVO",
        sucursalId: sucursalCentral.id,
      },
    });

    await prisma.usuario.upsert({
      where: { email: "encargado@servigaz.cl" },
      update: { passwordHash, estado: "ACTIVO" },
      create: {
        nombre: "Carlos Encargado Operaciones",
        email: "encargado@servigaz.cl",
        passwordHash,
        telefono: "+591 72098452",
        rol: "ENCARGADO",
        estado: "ACTIVO",
        sucursalId: sucursalCentral.id,
      },
    });

    await prisma.usuario.upsert({
      where: { email: "tecnico@servigaz.cl" },
      update: { passwordHash: passwordTechHash, estado: "ACTIVO" },
      create: {
        nombre: "Pedro Instalador Fijo",
        email: "tecnico@servigaz.cl",
        passwordHash: passwordTechHash,
        telefono: "+591 77234901",
        rol: "TECNICO_FIJO",
        estado: "ACTIVO",
        sucursalId: sucursalCentral.id,
      },
    });

    // 4. Configuración General (Fase 0)
    await prisma.configuracionGeneral.upsert({
      where: { id: "config-general-01" },
      update: { monedaBase: "BOB" },
      create: {
        id: "config-general-01",
        monedaBase: "BOB",
        margenMinimoPct: 25.0,
        alertaBajoMargenUmbralPct: 20.0,
        slaGarantiaHorasAlerta: 24,
        slaGarantiaHorasLimite: 168,
        activo: true,
        modificadoPor: admin.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Base de datos inicializada correctamente con usuarios por defecto.",
      usuarios: [
        { email: "admin@servigaz.cl", rol: "ADMIN" },
        { email: "encargado@servigaz.cl", rol: "ENCARGADO" },
        { email: "tecnico@servigaz.cl", rol: "TECNICO_FIJO" },
      ],
    });
  } catch (error: any) {
    console.error("Error en setup:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error durante la inicialización de la base de datos.",
        detalle: error.message || error.toString(),
        codigo: error.code || null,
      },
      { status: 500 }
    );
  }
}
