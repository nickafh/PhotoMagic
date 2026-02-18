import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingById, getListingWithUser, getPhotoFile, getSubmissionById, getLatestSubmissionForListing } from "@/lib/store";
import { canDownloadListing } from "@/lib/permissions";
import { zipFilenameForListing } from "@/lib/zip";
import { pad3, sanitizeAddress } from "@/lib/sanitize";
import { downloadStream } from "@/lib/blob";
import archiver from "archiver";
import { PassThrough } from "stream";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as { id: string });
  return resolved.id;
}

export async function GET(req: Request, ctx: Ctx) {
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

  if (!canDownloadListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const listing = await getListingById(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const safe = sanitizeAddress(listing.address || listing.sanitizedAddress || "listing");
  const filename = zipFilenameForListing(listing);

  // Determine photo order: use submission snapshot if available
  const url = new URL(req.url);
  const submissionIdParam = url.searchParams.get("submissionId");

  let orderedPhotoIds: string[] | null = null;

  if (submissionIdParam) {
    const submission = await getSubmissionById(submissionIdParam);
    if (submission && submission.listingId === id) {
      orderedPhotoIds = submission.orderedPhotoIds;
    }
  }

  if (!orderedPhotoIds) {
    // Try to find latest SUBMITTED or APPROVED submission
    const latestSubmission = await getLatestSubmissionForListing(id, {
      status: ["SUBMITTED", "APPROVED"],
    });
    if (latestSubmission) {
      orderedPhotoIds = latestSubmission.orderedPhotoIds;
    }
  }

  // Separate included and excluded photos
  const includedPhotos: string[] = [];
  const excludedPhotos: string[] = [];

  // Use submission order if available, otherwise fall back to listing order
  const photoIdList = orderedPhotoIds || listing.photoIds;

  for (const photoId of photoIdList) {
    const photo = listing.photos[photoId];
    if (!photo) continue; // Skip deleted photos
    if (photo.excluded) {
      excludedPhotos.push(photoId);
    } else {
      includedPhotos.push(photoId);
    }
  }

  // Add any photos in the listing that weren't in the submission (new photos added after submission)
  if (orderedPhotoIds) {
    const orderedSet = new Set(orderedPhotoIds);
    for (const photoId of listing.photoIds) {
      if (!orderedSet.has(photoId) && listing.photos[photoId]) {
        if (listing.photos[photoId].excluded) {
          excludedPhotos.push(photoId);
        } else {
          includedPhotos.push(photoId);
        }
      }
    }
  }

  // Create archive
  const archive = archiver("zip", { zlib: { level: 9 } });
  const passThrough = new PassThrough();

  archive.pipe(passThrough);

  // Add included photos to root
  for (let i = 0; i < includedPhotos.length; i++) {
    const photoId = includedPhotos[i];
    const file = await getPhotoFile(listing.id, photoId);
    if (!file) continue;

    const ext = file.meta.ext || "jpg";
    const name = `${pad3(i + 1)}_${safe}.${ext}`;
    try {
      const stream = await downloadStream(file.blobPath);
      archive.append(stream, { name });
    } catch (err) {
      console.error(`Failed to add photo ${photoId} to zip:`, err);
    }
  }

  // Add excluded photos to do_not_use/ subfolder
  for (let i = 0; i < excludedPhotos.length; i++) {
    const photoId = excludedPhotos[i];
    const file = await getPhotoFile(listing.id, photoId);
    if (!file) continue;

    const ext = file.meta.ext || "jpg";
    const name = `do_not_use/${pad3(i + 1)}_${safe}.${ext}`;
    try {
      const stream = await downloadStream(file.blobPath);
      archive.append(stream, { name });
    } catch (err) {
      console.error(`Failed to add photo ${photoId} to zip:`, err);
    }
  }

  archive.finalize();

  // Convert Node.js stream to Web ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      passThrough.on("end", () => {
        controller.close();
      });
      passThrough.on("error", (err) => {
        controller.error(err);
      });
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
