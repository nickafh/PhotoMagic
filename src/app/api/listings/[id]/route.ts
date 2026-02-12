import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingById, getListingWithUser, updateListing, deleteListing } from "@/lib/store";
import { canAccessListing, canModifyListing, canDeleteListing, canReorderListing, canApproveListing } from "@/lib/permissions";
import { sendEmail, buildApprovalEmail } from "@/lib/email";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as { id: string });
  return resolved.id;
}

// GET /api/listings/[id] - Fetch a listing
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

  // Create a mock session for permission checking
  const mockSession = { user: { id: user.id, role: user.role, email: user.email } };

  if (!canAccessListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const listing = await getListingById(id);
  return NextResponse.json(listing);
}

// PATCH /api/listings/[id] - Update listing fields
export async function PATCH(req: Request, ctx: Ctx) {
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

  const body = await req.json();

  // Check if this is an approval action
  const isApproving = body.status === "APPROVED" && listingWithUser.status !== "APPROVED";

  // Check reorder permission specifically for photoIds updates
  if (Array.isArray(body.photoIds)) {
    const canReorder = canReorderListing(
      mockSession as any,
      listingWithUser.userId,
      listingWithUser.status as "DRAFT" | "SUBMITTED" | "APPROVED"
    );

    if (!canReorder) {
      return NextResponse.json(
        { error: "Cannot reorder photos for this listing" },
        { status: 403 }
      );
    }
  } else if (isApproving) {
    // For approval, check approval permission
    if (!canApproveListing(mockSession as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // For other updates, use standard modify permission
    if (!canModifyListing(mockSession as any, listingWithUser.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await updateListing(id, body);

  if (!updated) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Send approval notification to the listing owner
  if (isApproving && listingWithUser.user) {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const activePhotoCount = listingWithUser.photos.filter((p) => !p.excluded).length;

      const { subject, body: emailBody } = buildApprovalEmail({
        listingAddress: listingWithUser.address,
        listingId: listingWithUser.id,
        approverName: user.name || "Listings Team",
        photoCount: activePhotoCount,
        baseUrl,
      });

      await sendEmail({
        to: listingWithUser.user.email,
        subject,
        body: emailBody,
      });
    } catch (error) {
      // Log error but don't fail the approval
      console.error("Failed to send approval notification:", error);
    }
  }

  return NextResponse.json(updated);
}

// DELETE /api/listings/[id] - Delete a listing
export async function DELETE(_req: Request, ctx: Ctx) {
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

  if (!canDeleteListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteListing(id);
  return NextResponse.json({ ok: true });
}
