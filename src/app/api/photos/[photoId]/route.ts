import { NextResponse } from "next/server";
import { getPhotoFile } from "@/lib/store";
import fs from "fs/promises";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ photoId: string }> | { photoId: string } };

async function getPhotoId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as any);
  return resolved.photoId;
}

export async function GET(req: Request, ctx: Ctx) {
  const photoId = await getPhotoId(ctx);

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  const useThumbnail = url.searchParams.get("thumb") === "1";

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  const file = await getPhotoFile(listingId, photoId, useThumbnail);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await fs.readFile(file.fullPath);

  // Thumbnails are always JPEG, originals use their mime type
  const contentType = file.isThumbnail ? "image/jpeg" : (file.meta.mime || "image/jpeg");

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable", // Cache aggressively
    },
  });
}