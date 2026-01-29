/**
 * Script to generate thumbnails for existing photos
 * Run with: npx tsx scripts/generate-thumbnails.ts
 */

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".data");
const LISTINGS_DIR = path.join(DATA_DIR, "listings");
const FILES_DIR = path.join(DATA_DIR, "files");
const THUMBS_DIR = path.join(DATA_DIR, "thumbs");

const THUMB_SIZE = 300;

async function main() {
  // Ensure thumbs directory exists
  await fs.mkdir(THUMBS_DIR, { recursive: true });

  // Get all listing files
  let listingFiles: string[];
  try {
    listingFiles = await fs.readdir(LISTINGS_DIR);
  } catch {
    console.log("No listings directory found");
    return;
  }

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const file of listingFiles) {
    if (!file.endsWith(".json")) continue;

    const listingPath = path.join(LISTINGS_DIR, file);
    const raw = await fs.readFile(listingPath, "utf-8");
    const listing = JSON.parse(raw);

    console.log(`\nProcessing listing: ${listing.title || listing.id}`);

    for (const photoId of listing.photoIds || []) {
      const meta = listing.photos?.[photoId];
      if (!meta) continue;

      const thumbPath = path.join(THUMBS_DIR, `${photoId}_thumb.jpg`);

      // Check if thumbnail already exists
      try {
        await fs.access(thumbPath);
        totalSkipped++;
        continue; // Skip if already exists
      } catch {
        // Thumbnail doesn't exist, generate it
      }

      const originalPath = path.join(FILES_DIR, meta.filename);

      try {
        const buffer = await fs.readFile(originalPath);
        const thumbBuffer = await sharp(buffer)
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "center" })
          .jpeg({ quality: 80 })
          .toBuffer();
        await fs.writeFile(thumbPath, thumbBuffer);
        console.log(`  ✓ Generated thumbnail for ${photoId}`);
        totalGenerated++;
      } catch (err) {
        console.error(`  ✗ Failed to generate thumbnail for ${photoId}:`, err);
        totalFailed++;
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Generated: ${totalGenerated}`);
  console.log(`Skipped (already exists): ${totalSkipped}`);
  console.log(`Failed: ${totalFailed}`);
}

main().catch(console.error);
