import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingWithUser, getLatestSubmissionForListing } from "@/lib/store";
import { canAccessListing } from "@/lib/permissions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as { id: string });
  return p.id;
}

// GET /api/listings/[id]/submission - Get latest submission for a listing
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await getId(ctx);

  const listingWithUser = await getListingWithUser(id);
  if (!listingWithUser) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const mockSession = { user: { id: user.id, role: user.role, email: user.email } };
  if (!canAccessListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submission = await getLatestSubmissionForListing(id);

  if (!submission) {
    return NextResponse.json(null);
  }

  return NextResponse.json(submission);
}
