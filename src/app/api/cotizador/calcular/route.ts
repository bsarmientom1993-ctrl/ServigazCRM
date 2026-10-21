import { requireSession, managers } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/api";
import { NextRequest } from "next/server";
export async function POST(req: NextRequest) {
  try {
    await requireSession(req, managers);
    throw new ApiError(410, "Selecciona un cliente registrado y crea o abre su solicitud en el cotizador. El presupuesto se emite desde esa orden para conservar su historial.");
  } catch (error) { return apiError(error); }
}
