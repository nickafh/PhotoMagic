import { NextResponse } from "next/server";
import { PassThrough } from "stream";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getListingById, getListingWithUser, getPhotoFile, getSubmissionById, getLatestSubmissionForListing } from "@/lib/store";
import { canDownloadListing } from "@/lib/permissions";
import { zipFilenameForListing } from "@/lib/zip";
import { pad3, sanitizeAddress } from "@/lib/sanitize";
import { downloadToBuffer } from "@/lib/blob";
import archiver from "archiver";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as { id: string });
  return resolved.id;
}

export async function GET(req: Request, ctx: Ctx) {
  try {
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

    // Download all photo buffers first
    const photoBuffers: { name: string; buf: Buffer }[] = [];

    for (let i = 0; i < includedPhotos.length; i++) {
      const photoId = includedPhotos[i];
      const file = await getPhotoFile(listing.id, photoId);
      if (!file) continue;

      const ext = file.meta.ext || "jpg";
      const name = `${pad3(i + 1)}_${safe}.${ext}`;
      try {
        const buf = await downloadToBuffer(file.blobPath);
        photoBuffers.push({ name, buf });
      } catch (err) {
        console.error(`Failed to download photo ${photoId}:`, err);
      }
    }

    for (let i = 0; i < excludedPhotos.length; i++) {
      const photoId = excludedPhotos[i];
      const file = await getPhotoFile(listing.id, photoId);
      if (!file) continue;

      const ext = file.meta.ext || "jpg";
      const name = `do_not_use/${pad3(i + 1)}_${safe}.${ext}`;
      try {
        const buf = await downloadToBuffer(file.blobPath);
        photoBuffers.push({ name, buf });
      } catch (err) {
        console.error(`Failed to download photo ${photoId}:`, err);
      }
    }

    if (photoBuffers.length === 0) {
      return NextResponse.json({ error: "No photos available to download" }, { status: 404 });
    }

    // Build the ZIP archive by piping through a PassThrough stream
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    for (const { name, buf } of photoBuffers) {
      archive.append(buf, { name });
    }

    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
      passThrough.on("end", () => resolve(Buffer.concat(chunks)));
      passThrough.on("error", reject);
      archive.on("error", reject);
      archive.finalize();
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("Download ZIP error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate ZIP" },
      { status: 500 }
    );
  }
}
