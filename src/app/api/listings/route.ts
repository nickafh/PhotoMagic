import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { createListing, getListingsByUserId, getListingsProposedToUser, getAllListings, countListings } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

// GET /api/listings - Get listings for current user or all (with permission)
export async function GET(req: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "DRAFT" | "SUBMITTED" | "APPROVED" | null;
  const search = url.searchParams.get("search") || undefined;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;
  const offset = url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!) : undefined;
  const all = url.searchParams.get("all") === "true";

  // If requesting all listings, check permission
  if (all) {
    if (!hasPermission(user.role, "listing:read_all")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const filterOpts = { status: status || undefined, search };

    const [listings, total] = await Promise.all([
      getAllListings({ ...filterOpts, limit, offset }),
      countListings(filterOpts),
    ]);

    return NextResponse.json({ listings, total });
  }

  // Get user's own listings + listings proposed to them
  const [ownListings, proposedListings] = await Promise.all([
    getListingsByUserId(user.id),
    getListingsProposedToUser(user.id),
  ]);

  // Merge and deduplicate by listing ID
  const seen = new Set(ownListings.map((l) => l.id));
  const merged = [...ownListings];
  for (const listing of proposedListings) {
    if (!seen.has(listing.id)) {
      merged.push(listing);
    }
  }

  // Sort by updatedAt descending
  merged.sort((a, b) => b.updatedAt - a.updatedAt);

  return NextResponse.json({ listings: merged, total: merged.length });
}

// POST /api/listings - Create a new listing
export async function POST(req: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, "listing:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const address = String(body.address || "").trim();

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const listing = await createListing({
    address,
    title: body.title ? String(body.title) : undefined,
    userId: user.id,
  });

  return NextResponse.json(listing);
}
