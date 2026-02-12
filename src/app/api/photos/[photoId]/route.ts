import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getPhotoFile, getListingWithUser, togglePhotoExcluded } from "@/lib/store";
import { canAccessListing, canModifyListing } from "@/lib/permissions";
import { downloadToBuffer } from "@/lib/blob";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ photoId: string }> | { photoId: string } };

async function getPhotoId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as { photoId: string });
  return resolved.photoId;
}

// GET /api/photos/[photoId] - Serve photo or thumbnail
export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const photoId = await getPhotoId(ctx);

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  const useThumbnail = url.searchParams.get("thumb") === "1";

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  // Check access permission
  const listingWithUser = await getListingWithUser(listingId);
  if (!listingWithUser) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const mockSession = { user: { id: user.id, role: user.role, email: user.email } };

  if (!canAccessListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await getPhotoFile(listingId, photoId, useThumbnail);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await downloadToBuffer(file.blobPath);
  } catch (err) {
    console.error("Failed to download blob:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Thumbnails are always JPEG, originals use their mime type
  const contentType = file.isThumbnail ? "image/jpeg" : (file.meta.mime || "image/jpeg");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

// PATCH /api/photos/[photoId] - Toggle excluded status
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const photoId = await getPhotoId(ctx);
  const body = await req.json();
  const listingId = body.listingId;

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  // Check modify permission
  const listingWithUser = await getListingWithUser(listingId);
  if (!listingWithUser) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const mockSession = { user: { id: user.id, role: user.role, email: user.email } };

  if (!canModifyListing(mockSession as any, listingWithUser.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const photo = await togglePhotoExcluded(listingId, photoId);

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json(photo);
}
