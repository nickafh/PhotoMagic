/**
 * One-time script to sync photo sortOrder for already-approved listings
 * so that DB order matches the approved submission's orderedPhotoIds.
 *
 * Run with: npx tsx scripts/sync-approved-sort-order.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/photomagic.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all APPROVED listings
  const approvedListings = await prisma.listing.findMany({
    where: { status: "APPROVED" },
    select: { id: true, address: true },
  });

  console.log(`Found ${approvedListings.length} approved listing(s)\n`);

  let fixed = 0;
  let skipped = 0;

  for (const listing of approvedListings) {
    // Get the latest APPROVED submission for this listing
    const submission = await prisma.photoOrderSubmission.findFirst({
      where: { listingId: listing.id, status: "APPROVED" },
      orderBy: { approvedAt: "desc" },
    });

    if (!submission) {
      console.log(`  [SKIP] ${listing.address} — no approved submission found`);
      skipped++;
      continue;
    }

    const orderedPhotoIds: string[] = JSON.parse(submission.orderedPhotoIds);

    // Update sortOrder for each photo to match the submission order
    const updates = orderedPhotoIds.map((photoId, index) =>
      prisma.photo.update({
        where: { id: photoId },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);
    console.log(`  [FIXED] ${listing.address} — synced ${orderedPhotoIds.length} photos`);
    fixed++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
