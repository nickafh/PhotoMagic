import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// GET /api/me - Get current user info from database
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}
