import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ userId: string }> | { userId: string } };

async function getUserId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as { userId: string });
  return resolved.userId;
}

// PATCH /api/users/[userId] - Update user role (ADMIN only)
export async function PATCH(req: Request, ctx: Ctx) {
  const currentUser = await getAuthenticatedUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mockSession = { user: { id: currentUser.id, role: currentUser.role, email: currentUser.email } };

  if (!isAdmin(mockSession as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = await getUserId(ctx);
  const body = await req.json();
  const { role } = body as { role: Role };

  // Validate role
  if (!["ADVISOR", "LISTINGS", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent admin from demoting themselves
  if (userId === currentUser.id && role !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role },
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

  return NextResponse.json(updatedUser);
}

// DELETE /api/users/[userId] - Delete user (ADMIN only)
export async function DELETE(req: Request, ctx: Ctx) {
  const currentUser = await getAuthenticatedUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mockSession = { user: { id: currentUser.id, role: currentUser.role, email: currentUser.email } };

  if (!isAdmin(mockSession as any)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = await getUserId(ctx);

  // Prevent admin from deleting themselves
  if (userId === currentUser.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  // Delete user (cascades to listings and photos in DB)
  await prisma.user.delete({
    where: { id: userId },
  });

  return NextResponse.json({ success: true });
}
