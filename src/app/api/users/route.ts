import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

// GET /api/users - List all users (ADMIN only)
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mockSession = { user: { id: user.id, role: user.role, email: user.email } };

  if (!isAdmin(mockSession as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: { listings: true },
      },
    },
  });

  return NextResponse.json(users);
}
