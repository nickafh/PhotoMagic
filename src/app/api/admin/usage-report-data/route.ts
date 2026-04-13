import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { getTenant } from "@/lib/tenant";
import prisma from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getTenant();

  const [users, listings, submissions, totalPhotos] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true },
    }),
    prisma.listing.findMany({
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { name: true, email: true } },
        collaborators: { select: { id: true, name: true, email: true } },
        _count: { select: { photos: true, submissions: true } },
      },
    }),
    prisma.photoOrderSubmission.findMany({
      select: { submittedAt: true },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.photo.count(),
  ]);

  // KPIs
  const totalUsers = users.length;
  const activeUserIds = new Set(listings.map((l) => l.userId));
  const activeUsers = activeUserIds.size;
  const propertyListings = listings.length;
  const totalSubmissions = submissions.length;
  const photosManaged = totalPhotos;
  const avgPhotosPerListing =
    propertyListings > 0 ? Math.round(photosManaged / propertyListings) : 0;

  // Status breakdown
  const statusBreakdown = {
    approved: listings.filter((l) => l.status === "APPROVED").length,
    submitted: listings.filter((l) => l.status === "SUBMITTED").length,
    draft: listings.filter((l) => l.status === "DRAFT").length,
  };

  // Build advisor lookup (used by adoption + top users)
  const advisorMap = new Map<string, { name: string; email: string }>();
  for (const u of users) {
    if (u.role === "ADVISOR") {
      advisorMap.set(u.id, { name: u.name || u.email, email: u.email });
    }
  }

  // Adoption — based on ADVISOR role users who have been sent a listing
  const registeredAdvisors = advisorMap.size;
  const activeAdvisorIds = new Set<string>();
  for (const listing of listings) {
    for (const collab of listing.collaborators) {
      if (advisorMap.has(collab.id)) {
        activeAdvisorIds.add(collab.id);
      }
    }
    if (advisorMap.has(listing.userId)) {
      activeAdvisorIds.add(listing.userId);
    }
  }
  const activeAdvisors = activeAdvisorIds.size;
  const staffAccounts = users.filter(
    (u) => u.role === "ADMIN" || u.role === "LISTINGS"
  ).length;
  const adoptionPercent =
    registeredAdvisors > 0
      ? Math.round((activeAdvisors / registeredAdvisors) * 100)
      : 0;

  // Daily volume - group submissions by date
  const volumeMap = new Map<string, number>();
  for (const sub of submissions) {
    const date = new Date(sub.submittedAt);
    const key = `${date.getMonth() + 1}/${date.getDate()}`;
    volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
  }
  const dailyVolume = Array.from(volumeMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // Top advisors by listings sent to them (collaborators = advisors a listing was proposed to)
  const advisorListingMap = new Map<
    string,
    { name: string; listings: number; photos: number }
  >();
  for (const listing of listings) {
    // Count each advisor collaborator on this listing
    for (const collab of listing.collaborators) {
      if (!advisorMap.has(collab.id)) continue;
      const existing = advisorListingMap.get(collab.id);
      if (existing) {
        existing.listings++;
        existing.photos += listing._count.photos;
      } else {
        advisorListingMap.set(collab.id, {
          name: collab.name || collab.email,
          listings: 1,
          photos: listing._count.photos,
        });
      }
    }
    // Also count if an advisor owns the listing directly
    if (advisorMap.has(listing.userId) && !advisorListingMap.has(listing.userId)) {
      advisorListingMap.set(listing.userId, {
        name: listing.user.name || listing.user.email,
        listings: 1,
        photos: listing._count.photos,
      });
    } else if (advisorMap.has(listing.userId) && !listing.collaborators.some((c) => c.id === listing.userId)) {
      const existing = advisorListingMap.get(listing.userId)!;
      existing.listings++;
      existing.photos += listing._count.photos;
    }
  }
  const topUsers = Array.from(advisorListingMap.values())
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 10);

  // Email domains
  const domainMap = new Map<string, number>();
  for (const u of users) {
    const domain = u.email.split("@")[1] || "unknown";
    domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
  }
  const emailDomains = Array.from(domainMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  let consolidatedDomains = emailDomains;
  if (emailDomains.length > 5) {
    const top = emailDomains.slice(0, 4);
    const rest = emailDomains.slice(4);
    const otherCount = rest.reduce((sum, d) => sum + d.count, 0);
    consolidatedDomains = [
      ...top,
      { name: `Other (${rest.length} domains)`, count: otherCount },
    ];
  }

  // Photo distribution buckets
  const photoBuckets = [
    { label: "1\u201325", min: 1, max: 25, count: 0 },
    { label: "26\u201350", min: 26, max: 50, count: 0 },
    { label: "51\u201375", min: 51, max: 75, count: 0 },
    { label: "76\u2013100", min: 76, max: 100, count: 0 },
    { label: "101\u2013150", min: 101, max: 150, count: 0 },
    { label: "150+", min: 151, max: Infinity, count: 0 },
  ];
  for (const listing of listings) {
    const count = listing._count.photos;
    if (count === 0) continue;
    for (const bucket of photoBuckets) {
      if (count >= bucket.min && count <= bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  return NextResponse.json({
    tenantName: tenant.name,
    tenantUrl: tenant.baseUrl,
    generatedAt: new Date().toISOString(),
    kpis: {
      totalUsers,
      activeUsers,
      propertyListings,
      totalSubmissions,
      photosManaged,
      avgPhotosPerListing,
    },
    statusBreakdown,
    adoption: {
      registeredAdvisors,
      activeAdvisors,
      noActivity: registeredAdvisors - activeAdvisors,
      staffAccounts,
      adoptionPercent,
    },
    dailyVolume,
    topUsers,
    emailDomains: consolidatedDomains,
    photoDistribution: photoBuckets.map(({ label, count }) => ({
      label,
      count,
    })),
  });
}
