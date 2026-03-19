import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingWithUser, createSubmission, getUserById, updateListing, addCollaboratorsToListing } from "@/lib/store";
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

  // Support both single advisorId and multiple advisorIds
  const advisorIds: string[] = Array.isArray(body.advisorIds)
    ? body.advisorIds
    : body.advisorId
      ? [body.advisorId]
      : [];

  if (!Array.isArray(orderedPhotoIds) || orderedPhotoIds.length === 0) {
    return NextResponse.json({ error: "orderedPhotoIds must be a non-empty array" }, { status: 400 });
  }

  if (advisorIds.length === 0) {
    return NextResponse.json({ error: "At least one advisor is required" }, { status: 400 });
  }

  // Validate all photo IDs belong to this listing
  const listingPhotoIds = new Set(listingWithUser.photos.map((p) => p.id));
  for (const pid of orderedPhotoIds) {
    if (!listingPhotoIds.has(pid)) {
      return NextResponse.json({ error: `Photo ${pid} does not belong to this listing` }, { status: 400 });
    }
  }

  // If listing is still DRAFT, move it to SUBMITTED
  if (listingWithUser.status === "DRAFT") {
    await updateListing(id, { status: "SUBMITTED" });
  }

  // Add all selected advisors as collaborators on the listing
  await addCollaboratorsToListing(id, advisorIds);

  // Create a single submission (proposedToUserId uses the first advisor for backward compat)
  const submission = await createSubmission({
    listingId: id,
    initiatorRole: "LISTINGS",
    approverRole: "ADVISOR",
    orderedPhotoIds,
    submittedByUserId: user.id,
    note,
    proposedToUserId: advisorIds[0],
  });

  // Send notification emails to all selected advisors
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    for (const advisorId of advisorIds) {
      const advisor = await getUserById(advisorId);
      if (!advisor?.email) continue;

      const { subject, body: emailBody } = buildProposalEmail({
        address: listingWithUser.address,
        advisorName: advisor.name || "",
        photoCount: orderedPhotoIds.length,
        listingId: id,
        baseUrl,
        note,
      });

      await sendEmail({ to: advisor.email, subject, body: emailBody });
    }
  } catch (err) {
    console.error("Failed to send proposal notification:", err);
  }

  return NextResponse.json(submission);
}
