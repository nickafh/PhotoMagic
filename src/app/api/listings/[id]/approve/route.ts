import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getSubmissionById, approveSubmission, getListingWithUser, getUserById } from "@/lib/store";
import { sendEmail, buildApprovalEmail } from "@/lib/email";
import { getListingsTeamMembers } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as { id: string });
  return p.id;
}

// POST /api/listings/[id]/approve - Approve a submission
export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await getId(ctx);
  const body = await req.json();
  const { submissionId } = body as { submissionId: string };

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
    return NextResponse.json({ error: "You are not authorized to approve this submission" }, { status: 403 });
  }

  const approved = await approveSubmission(submissionId, user.id);

  // Send notification to the initiator
  try {
    const listingWithUser = await getListingWithUser(id);
    if (listingWithUser) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const activePhotoCount = listingWithUser.photos.filter((p) => !p.excluded).length;

      if (submission.initiatorRole === "ADVISOR") {
        // Advisor submitted, listings approved → email advisor
        const owner = await getUserById(listingWithUser.userId);
        if (owner?.email) {
          const { subject, body: emailBody } = buildApprovalEmail({
            listingAddress: listingWithUser.address,
            listingId: id,
            approverName: user.name || "Listings Team",
            photoCount: activePhotoCount,
            baseUrl,
          });
          await sendEmail({ to: owner.email, subject, body: emailBody });
        }
      } else {
        // Listings submitted, advisor approved → email listings team
        const listingsTeamEmail = process.env.LISTINGS_TEAM_EMAIL;
        if (listingsTeamEmail) {
          const { subject, body: emailBody } = buildApprovalEmail({
            listingAddress: listingWithUser.address,
            listingId: id,
            approverName: user.name || "Advisor",
            photoCount: activePhotoCount,
            baseUrl,
          });
          await sendEmail({ to: listingsTeamEmail, subject, body: emailBody });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send approval notification:", err);
  }

  return NextResponse.json(approved);
}
