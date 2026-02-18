import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getSubmissionById, requestChangesOnSubmission, getListingWithUser, getUserById } from "@/lib/store";
import { sendEmail, buildChangesRequestedEmail } from "@/lib/email";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as { id: string });
  return p.id;
}

// POST /api/listings/[id]/request-changes - Request changes on a submission
export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await getId(ctx);
  const body = await req.json();
  const { submissionId, note } = body as { submissionId: string; note?: string };

  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.listingId !== id) {
    return NextResponse.json({ error: "Submission does not belong to this listing" }, { status: 400 });
  }

  if (submission.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Submission is not in SUBMITTED status" }, { status: 400 });
  }

  // Check caller's role matches approverRole
  const callerIsApprover =
    (submission.approverRole === "ADVISOR" && user.role === "ADVISOR") ||
    (submission.approverRole === "LISTINGS" && (user.role === "LISTINGS" || user.role === "ADMIN")) ||
    user.role === "ADMIN";

  if (!callerIsApprover) {
    return NextResponse.json({ error: "You are not authorized to request changes on this submission" }, { status: 403 });
  }

  const updated = await requestChangesOnSubmission(submissionId, note);

  // Send notification to the initiator
  try {
    const listingWithUser = await getListingWithUser(id);
    if (listingWithUser) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      if (submission.initiatorRole === "ADVISOR") {
        // Advisor submitted → email advisor
        const owner = await getUserById(listingWithUser.userId);
        if (owner?.email) {
          const { subject, body: emailBody } = buildChangesRequestedEmail({
            address: listingWithUser.address,
            reviewerName: user.name || "Listings Team",
            note,
            listingId: id,
            baseUrl,
          });
          await sendEmail({ to: owner.email, subject, body: emailBody });
        }
      } else {
        // Listings submitted → email listings team
        const listingsTeamEmail = process.env.LISTINGS_TEAM_EMAIL;
        if (listingsTeamEmail) {
          const { subject, body: emailBody } = buildChangesRequestedEmail({
            address: listingWithUser.address,
            reviewerName: user.name || "Advisor",
            note,
            listingId: id,
            baseUrl,
          });
          await sendEmail({ to: listingsTeamEmail, subject, body: emailBody });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send changes requested notification:", err);
  }

  return NextResponse.json(updated);
}
