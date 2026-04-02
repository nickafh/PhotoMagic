import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import prisma from "@/lib/db";

export const runtime = "nodejs";

// GET /api/admin/usage-report - Download CSV of all users and their property usage
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all users with their owned listings, collaborated listings, and submission activity
  const users = await prisma.user.findMany({
    include: {
      listings: {
        include: {
          photos: { select: { id: true } },
          submissions: {
            select: { id: true, status: true, submittedAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      collaboratedListings: {
        include: {
          photos: { select: { id: true } },
          user: { select: { name: true, email: true } },
          submissions: {
            select: { id: true, status: true, submittedAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Build CSV rows: one row per user+property combination
  const rows: string[][] = [];
  const header = [
    "User Name",
    "User Email",
    "User Role",
    "Relationship",
    "Property Address",
    "Listing Status",
    "Photo Count",
    "Times Submitted",
    "Date Created",
    "Last Updated",
  ];
  rows.push(header);

  for (const u of users) {
    const hasActivity = u.listings.length > 0 || u.collaboratedListings.length > 0;

    // Owned listings
    for (const listing of u.listings) {
      rows.push([
        u.name || "",
        u.email,
        u.role,
        "Owner",
        listing.address,
        listing.status,
        String(listing.photos.length),
        String(listing.submissions.length),
        new Date(listing.createdAt).toLocaleDateString("en-US"),
        new Date(listing.updatedAt).toLocaleDateString("en-US"),
      ]);
    }

    // Collaborated listings
    for (const listing of u.collaboratedListings) {
      rows.push([
        u.name || "",
        u.email,
        u.role,
        "Collaborator",
        listing.address,
        listing.status,
        String(listing.photos.length),
        String(listing.submissions.length),
        new Date(listing.createdAt).toLocaleDateString("en-US"),
        new Date(listing.updatedAt).toLocaleDateString("en-US"),
      ]);
    }

    // Users with no listings still get a row so Ashley sees everyone
    if (!hasActivity) {
      rows.push([
        u.name || "",
        u.email,
        u.role,
        "No activity",
        "",
        "",
        "",
        "",
        "",
        new Date(u.createdAt).toLocaleDateString("en-US"),
      ]);
    }
  }

  // Convert to CSV with proper escaping
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="photomagic-usage-report-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
