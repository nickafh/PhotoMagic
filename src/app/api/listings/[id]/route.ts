import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { toLegacyListing, getListingWithUser, updateListing, deleteListing, hasListingAccess } from "@/lib/store";
import { canAccessListing, canModifyListing, canDeleteListing, canReorderListing, canApproveListing } from "@/lib/permissions";
import { sendEmail, buildApprovalEmail } from "@/lib/email";
import { getTenant } from "@/lib/tenant";

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
    // Fallback: allow access if the user is a collaborator or was proposed to
    const hasAccess = await hasListingAccess(id, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(toLegacyListing(listingWithUser));
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
      // Allow collaborators/proposed advisors to reorder
      const hasAccess = await hasListingAccess(id, user.id);
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Cannot reorder photos for this listing" },
          { status: 403 }
        );
      }
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
      const tenant = await getTenant();
      const activePhotoCount = listingWithUser.photos.filter((p) => !p.excluded).length;

      const { subject, body: emailBody } = buildApprovalEmail({
        listingAddress: listingWithUser.address,
        listingId: listingWithUser.id,
        approverName: user.name || "Listings Team",
        photoCount: activePhotoCount,
        baseUrl: tenant.baseUrl,
      });

      await sendEmail({
        to: listingWithUser.user.email,
        subject,
        body: emailBody,
        from: tenant.fromEmail,
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
