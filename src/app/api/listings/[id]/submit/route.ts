import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingWithUser, updateListing } from "@/lib/store";
import { canModifyListing } from "@/lib/permissions";
import { sendEmail, buildSubmissionEmail } from "@/lib/email";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as { id: string });
  return p.id;
}

// POST /api/listings/[id]/submit - Submit listing for review
export async function POST(_req: Request, ctx: Ctx) {
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

  if (!canModifyListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Can only submit if currently DRAFT
  if (listingWithUser.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Listing has already been submitted" },
      { status: 400 }
    );
  }

  // Count non-excluded photos
  const activePhotoCount = listingWithUser.photos.filter((p) => !p.excluded).length;

  if (activePhotoCount === 0) {
    return NextResponse.json(
      { error: "Cannot submit listing with no photos" },
      { status: 400 }
    );
  }

  // Update status to SUBMITTED
  const updated = await updateListing(id, { status: "SUBMITTED" });

  // Send notification email
  const listingsTeamEmail = process.env.LISTINGS_TEAM_EMAIL;
  if (listingsTeamEmail) {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const { subject, body } = buildSubmissionEmail({
        listingAddress: listingWithUser.address,
        listingId: listingWithUser.id,
        submitterName: user.name || "Unknown",
        submitterEmail: user.email,
        photoCount: activePhotoCount,
        baseUrl,
      });

      await sendEmail({
        to: listingsTeamEmail,
        subject,
        body,
      });
    } catch (error) {
      // Log error but don't fail the submission
      console.error("Failed to send notification email:", error);
    }
  }

  return NextResponse.json(updated);
}
