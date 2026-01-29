import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import sharp from "sharp";
import type { Listing, PhotoMeta } from "@/lib/types";
import { sanitizeAddress } from "@/lib/sanitize";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".data");
const LISTINGS_DIR = path.join(DATA_DIR, "listings");
const FILES_DIR = path.join(DATA_DIR, "files");
const THUMBS_DIR = path.join(DATA_DIR, "thumbs");

const THUMB_SIZE = 300; // px for thumbnail width

export async function ensureDataDirs() {
  await fs.mkdir(LISTINGS_DIR, { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.mkdir(THUMBS_DIR, { recursive: true });
}

function listingPath(id: string) {
  return path.join(LISTINGS_DIR, `${id}.json`);
}

export async function createListing(input: { address: string; title?: string }): Promise<Listing> {
  await ensureDataDirs();

  const id = nanoid(10);
  const now = Date.now();

  const address = (input.address || "").trim();
  const sanitizedAddress = sanitizeAddress(address);

  const listing: Listing = {
    id,
    title: input.title || "Collection",
    address,
    sanitizedAddress,
    photoIds: [],
    photos: {},
    createdAt: now,
    updatedAt: now,
  };

  await fs.writeFile(listingPath(id), JSON.stringify(listing, null, 2), "utf-8");
  return listing;
}

export async function getListingById(id: string): Promise<Listing | null> {
  try {
    const raw = await fs.readFile(listingPath(id), "utf-8");
    return JSON.parse(raw) as Listing;
  } catch {
    return null;
  }
}

export async function saveListing(listing: Listing): Promise<Listing> {
  listing.updatedAt = Date.now();
  await fs.writeFile(listingPath(listing.id), JSON.stringify(listing, null, 2), "utf-8");
  return listing;
}

export async function updateListing(
  id: string,
  patch: Partial<Pick<Listing, "address" | "title" | "photoIds">>
): Promise<Listing | null> {
  const listing = await getListingById(id);
  if (!listing) return null;

  if (typeof patch.title === "string") listing.title = patch.title;
  if (typeof patch.address === "string") {
    listing.address = patch.address.trim();
    listing.sanitizedAddress = sanitizeAddress(listing.address);
  }
  if (Array.isArray(patch.photoIds)) {
    listing.photoIds = patch.photoIds;
  }

  await saveListing(listing);
  return listing;
}

export function photoPath(photoId: string) {
  return path.join(FILES_DIR, photoId);
}

export async function addPhotoToListing(args: {
  listingId: string;
  buffer: Buffer;
  originalName: string;
  mime: string;
}): Promise<{ listing: Listing; photo: PhotoMeta }> {
  const listing = await getListingById(args.listingId);
  if (!listing) throw new Error("Listing not found");

  await ensureDataDirs();

  const id = nanoid(12);
  const createdAt = Date.now();

  const ext = guessExt(args.originalName, args.mime);

  // store binary file as .data/files/<photoId>.<ext>
  const storedName = `${id}.${ext}`;
  const thumbName = `${id}_thumb.jpg`;

  // Write original file
  await fs.writeFile(path.join(FILES_DIR, storedName), args.buffer);

  // Generate thumbnail (300px wide, JPEG for smaller size)
  try {
    const thumbBuffer = await sharp(args.buffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "center" })
      .jpeg({ quality: 80 })
      .toBuffer();
    await fs.writeFile(path.join(THUMBS_DIR, thumbName), thumbBuffer);
  } catch (err) {
    console.error("Failed to generate thumbnail:", err);
    // If thumbnail fails, we'll fall back to original in getPhotoFile
  }

  const photo: PhotoMeta = {
    id,
    listingId: listing.id,
    originalName: args.originalName,
    filename: storedName,
    mime: args.mime,
    ext,
    createdAt,
  };

  listing.photos[id] = photo;
  listing.photoIds.push(id);

  await saveListing(listing);
  return { listing, photo };
}

export async function getPhotoFile(listingId: string, photoId: string, thumbnail = false) {
  const listing = await getListingById(listingId);
  if (!listing) return null;

  const meta = listing.photos[photoId];
  if (!meta) return null;

  if (thumbnail) {
    const thumbPath = path.join(THUMBS_DIR, `${photoId}_thumb.jpg`);
    try {
      await fs.access(thumbPath);
      return { fullPath: thumbPath, meta, isThumbnail: true };
    } catch {
      // Thumbnail doesn't exist, fall back to original
    }
  }

  const full = path.join(FILES_DIR, meta.filename);
  return { fullPath: full, meta, isThumbnail: false };
}

export async function deletePhotoFromListing(listingId: string, photoId: string): Promise<Listing | null> {
  const listing = await getListingById(listingId);
  if (!listing) return null;

  const meta = listing.photos[photoId];
  if (!meta) return listing;

  // remove original file
  try {
    await fs.unlink(path.join(FILES_DIR, meta.filename));
  } catch {}

  // remove thumbnail
  try {
    await fs.unlink(path.join(THUMBS_DIR, `${photoId}_thumb.jpg`));
  } catch {}

  delete listing.photos[photoId];
  listing.photoIds = listing.photoIds.filter((id) => id !== photoId);

  await saveListing(listing);
  return listing;
}

function guessExt(name: string, mime: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}