import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("servigaz_token");
  response.cookies.delete('servigaz_rol');
  return response;
}
