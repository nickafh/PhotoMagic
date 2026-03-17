import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import prisma from "@/lib/db";

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approvedListings = await prisma.listing.findMany({
    where: { status: "APPROVED" },
    select: { id: true, address: true },
  });

  const results: { address: string; status: string }[] = [];

  for (const listing of approvedListings) {
    const submission = await prisma.photoOrderSubmission.findFirst({
      where: { listingId: listing.id, status: "APPROVED" },
      orderBy: { approvedAt: "desc" },
    });

    if (!submission) {
      results.push({ address: listing.address, status: "skipped — no approved submission" });
      continue;
    }

    const orderedPhotoIds: string[] = JSON.parse(submission.orderedPhotoIds);
    const updates = orderedPhotoIds.map((photoId, index) =>
      prisma.photo.update({
        where: { id: photoId },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);
    results.push({ address: listing.address, status: `fixed — synced ${orderedPhotoIds.length} photos` });
  }

  return NextResponse.json({ fixed: results.filter(r => r.status.startsWith("fixed")).length, results });
}
