import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "La inicialización se realiza desde la consola administrativa." }, { status: 410 });
}
