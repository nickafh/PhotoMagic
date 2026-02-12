import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { createListing, getListingsByUserId, getAllListings, countListings, getListingsTeamMembers } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";
import { sendEmail, buildNewListingEmail } from "@/lib/email";

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

    const listings = await getAllListings({
      status: status || undefined,
      search,
      limit,
      offset,
    });

    const total = await countListings({
      status: status || undefined,
      search,
    });

    return NextResponse.json({ listings, total });
  }

  // Get user's own listings
  const listings = await getListingsByUserId(user.id);
  return NextResponse.json({ listings, total: listings.length });
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

  // Notify listings team members about new listing
  try {
    const teamMembers = await getListingsTeamMembers();
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const { subject, body: emailBody } = buildNewListingEmail({
      listingAddress: address,
      listingId: listing.id,
      creatorName: user.name || "Unknown",
      creatorEmail: user.email,
      baseUrl,
    });

    // Send email to each team member
    for (const member of teamMembers) {
      if (member.email !== user.email) {
        await sendEmail({
          to: member.email,
          subject,
          body: emailBody,
        });
      }
    }
  } catch (error) {
    // Log error but don't fail the listing creation
    console.error("Failed to send new listing notification:", error);
  }

  return NextResponse.json(listing);
}
