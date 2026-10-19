import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: error instanceof ZodError ? error.issues[0]?.message || "Datos inválidos" : "Solicitud inválida" }, { status: 400 });
  }
  if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) {
    return NextResponse.json({ error: "La orden cambió durante la operación. Actualiza e intenta de nuevo." }, { status: 409 });
  }
  console.error(error);
  return NextResponse.json({ error: "No se pudo completar la operación. Intenta nuevamente." }, { status: 500 });
}

