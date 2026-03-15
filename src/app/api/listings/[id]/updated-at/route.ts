import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import prisma from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as { id: string });
  return resolved.id;
}

// GET /api/listings/[id]/updated-at - Lightweight timestamp check for polling
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await getId(ctx);

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { updatedAt: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ updatedAt: listing.updatedAt.getTime() });
}
