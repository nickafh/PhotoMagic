import archiver from "archiver";
import type { LegacyListing } from "@/lib/types";
import { pad3, sanitizeAddress } from "@/lib/sanitize";
import { getPhotoFile } from "@/lib/store";
import { downloadStream } from "@/lib/blob";

export function zipFilenameForListing(listing: LegacyListing) {
  const safe = sanitizeAddress(listing.address || listing.sanitizedAddress || "listing");
  return `${safe}_photos.zip`;
}

export async function streamListingZip(listing: LegacyListing, res: any) {
  const safe = sanitizeAddress(listing.address || listing.sanitizedAddress || "listing");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFilenameForListing(listing)}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(res);

  // Separate included and excluded photos
  const includedPhotos: string[] = [];
  const excludedPhotos: string[] = [];

  for (const photoId of listing.photoIds) {
    const photo = listing.photos[photoId];
    if (photo?.excluded) {
      excludedPhotos.push(photoId);
    } else {
      includedPhotos.push(photoId);
    }
  }

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

  await archive.finalize();
}
