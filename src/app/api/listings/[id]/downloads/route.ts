import { NextResponse } from "next/server";
import { PassThrough, Readable } from "stream";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { toLegacyListing, getListingWithUser, getPhotoFile, getSubmissionById, getLatestSubmissionForListing } from "@/lib/store";
import { canDownloadListing } from "@/lib/permissions";
import { zipFilenameForListing } from "@/lib/zip";
import { pad3, sanitizeAddress } from "@/lib/sanitize";
import { downloadStream, getBlobSize } from "@/lib/blob";
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

    const listing = toLegacyListing(listingWithUser);

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

    // Resolve photo metadata (blob paths + names) before streaming
    const photoEntries: { name: string; blobPath: string }[] = [];

    for (let i = 0; i < includedPhotos.length; i++) {
      const photoId = includedPhotos[i];
      const file = await getPhotoFile(listing.id, photoId);
      if (!file) continue;
      const ext = file.meta.ext || "jpg";
      photoEntries.push({
        name: `${pad3(i + 1)}_${safe}.${ext}`,
        blobPath: file.blobPath,
      });
    }

    for (let i = 0; i < excludedPhotos.length; i++) {
      const photoId = excludedPhotos[i];
      const file = await getPhotoFile(listing.id, photoId);
      if (!file) continue;
      const ext = file.meta.ext || "jpg";
      photoEntries.push({
        name: `do_not_use/${pad3(i + 1)}_${safe}.${ext}`,
        blobPath: file.blobPath,
      });
    }

    if (photoEntries.length === 0) {
      return NextResponse.json({ error: "No photos available to download" }, { status: 404 });
    }

    // Fetch all blob sizes in parallel (lightweight HEAD requests, no data downloaded)
    const sizes = await Promise.all(
      photoEntries.map((e) => getBlobSize(e.blobPath).catch(() => 0))
    );

    // Calculate ZIP size for store (level 0): local header + data + data descriptor per file + central dir + end record
    // ZIP local file header: 30 bytes + filename length
    // Data descriptor: 16 bytes per entry
    // Central directory entry: 46 bytes + filename length
    // End of central directory: 22 bytes
    let zipSize = 22; // end of central directory
    for (let i = 0; i < photoEntries.length; i++) {
      const nameLen = Buffer.byteLength(photoEntries[i].name, "utf8");
      zipSize += 30 + nameLen + sizes[i] + 16; // local header + data + descriptor
      zipSize += 46 + nameLen; // central directory entry
    }

    // Stream: photos flow from Azure Blob -> archiver -> response (no full buffering)
    const archive = archiver("zip", { zlib: { level: 0 } }); // level 0: images are already compressed
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    // Append each photo as a stream from Azure Blob (one at a time, never all in memory)
    (async () => {
      for (const entry of photoEntries) {
        try {
          const stream = await downloadStream(entry.blobPath);
          archive.append(stream, { name: entry.name });
        } catch (err) {
          console.error(`Failed to stream photo ${entry.blobPath}:`, err);
        }
      }
      archive.finalize();
    })();

    // Convert Node stream to Web ReadableStream for the response
    const webStream = Readable.toWeb(passThrough) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipSize),
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
