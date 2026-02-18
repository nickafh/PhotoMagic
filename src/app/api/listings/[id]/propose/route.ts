import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingWithUser, createSubmission, getUserById } from "@/lib/store";
import { sendEmail, buildProposalEmail } from "@/lib/email";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as { id: string });
  return p.id;
}

// POST /api/listings/[id]/propose - Listings team proposes a photo order
export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "LISTINGS" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = await getId(ctx);
  const listingWithUser = await getListingWithUser(id);
  if (!listingWithUser) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const body = await req.json();
  const { orderedPhotoIds, note } = body as { orderedPhotoIds: string[]; note?: string };

  if (!Array.isArray(orderedPhotoIds) || orderedPhotoIds.length === 0) {
    return NextResponse.json({ error: "orderedPhotoIds must be a non-empty array" }, { status: 400 });
  }

  // Validate all photo IDs belong to this listing
  const listingPhotoIds = new Set(listingWithUser.photos.map((p) => p.id));
  for (const pid of orderedPhotoIds) {
    if (!listingPhotoIds.has(pid)) {
      return NextResponse.json({ error: `Photo ${pid} does not belong to this listing` }, { status: 400 });
    }
  }

  const submission = await createSubmission({
    listingId: id,
    initiatorRole: "LISTINGS",
    approverRole: "ADVISOR",
    orderedPhotoIds,
    submittedByUserId: user.id,
    note,
  });

  // Send notification email to the listing owner (advisor)
  try {
    const owner = await getUserById(listingWithUser.userId);
    if (owner?.email) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const { subject, body: emailBody } = buildProposalEmail({
        address: listingWithUser.address,
        proposerName: user.name || "Listings Team",
        proposerEmail: user.email,
        photoCount: orderedPhotoIds.length,
        listingId: id,
        baseUrl,
      });

      await sendEmail({ to: owner.email, subject, body: emailBody });
    }
  } catch (err) {
    console.error("Failed to send proposal notification:", err);
  }

  return NextResponse.json(submission);
}
