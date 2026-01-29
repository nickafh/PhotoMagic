import { NextResponse } from "next/server";
import { getListingById, updateListing } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Next.js 16 safe params handling
 */
type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as any);
  return resolved.id;
}

/**
 * GET /api/listings/[id]
 * Fetch a listing
 */
export async function GET(_req: Request, ctx: Ctx) {
  const id = await getId(ctx);

  const listing = await getListingById(id);
  if (!listing) {
    return NextResponse.json(
      { error: "Listing not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(listing);
}

/**
 * PATCH /api/listings/[id]
 * Update listing fields (address, photo order, etc)
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const id = await getId(ctx);
  const body = await req.json();

  const updated = await updateListing(id, body);
  if (!updated) {
    return NextResponse.json(
      { error: "Listing not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}