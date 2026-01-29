import archiver from "archiver";
import type { Listing } from "@/lib/types";
import { pad3, sanitizeAddress } from "@/lib/sanitize";
import { getPhotoFile } from "@/lib/store";
import fs from "fs";

export function zipFilenameForListing(listing: Listing) {
  const safe = sanitizeAddress(listing.address || listing.sanitizedAddress || "listing");
  return `${safe}_photos.zip`;
}

export async function streamListingZip(listing: Listing, res: any) {
  const safe = sanitizeAddress(listing.address || listing.sanitizedAddress || "listing");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFilenameForListing(listing)}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(res);

  for (let i = 0; i < listing.photoIds.length; i++) {
    const photoId = listing.photoIds[i];
    const file = await getPhotoFile(listing.id, photoId);
    if (!file) continue;

    const ext = file.meta.ext || "jpg";
    const name = `${pad3(i + 1)}_${safe}.${ext}`;
    archive.append(fs.createReadStream(file.fullPath), { name });
  }

  await archive.finalize();
}