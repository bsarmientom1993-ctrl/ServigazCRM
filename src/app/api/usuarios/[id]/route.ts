import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { updateProfile } from "@/lib/user-profile";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req, ["ADMIN"]); const { id } = await params;
    return NextResponse.json({ user: await updateProfile(session, id, await req.json()) });
  } catch (error) { return apiError(error); }
}
