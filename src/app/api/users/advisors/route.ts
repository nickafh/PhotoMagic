import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import prisma from "@/lib/db";

export const runtime = "nodejs";

// GET /api/users/advisors?search= - returns list of advisor users
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "LISTINGS" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() || "";

  const where: { role: "ADVISOR"; OR?: Array<{ name?: { contains: string }; email?: { contains: string } }> } = {
    role: "ADVISOR",
  };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const advisors = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(advisors);
}
