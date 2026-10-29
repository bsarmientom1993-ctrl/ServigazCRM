import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { updateProfile } from "@/lib/user-profile";
import { updateUserRoles } from '@/lib/manage-user-roles';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req, ["ADMIN"]); const { id } = await params;
    const input=await req.json();
    return NextResponse.json({ user: input&&typeof input==='object'&&'roles' in input?await updateUserRoles(session,id,input):await updateProfile(session, id, input) });
  } catch (error) { return apiError(error); }
}
