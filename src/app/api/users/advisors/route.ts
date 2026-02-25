import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getAdvisors } from "@/lib/store";

export const runtime = "nodejs";

// GET /api/users/advisors - returns list of advisor users
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "LISTINGS" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const advisors = await getAdvisors();
  return NextResponse.json(advisors);
}
