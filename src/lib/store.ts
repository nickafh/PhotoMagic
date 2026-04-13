import sharp from "sharp";
import prisma from "@/lib/db";
import type { ListingWithPhotos, LegacyListing, PhotoMeta, PhotoOrderSubmissionData, Role, SubmissionStatus } from "@/lib/types";
import { sanitizeAddress } from "@/lib/sanitize";
import {
  blobPathOriginal,
  blobPathThumb,
  uploadOriginal,
  uploadThumbnail,
  deleteBlob,
} from "@/lib/blob";

const THUMB_SIZE = 300; // px for thumbnail width

/** No-op for Blob storage; kept for API compatibility with createListing */
export async function ensureDataDirs() {
  // Blob storage - no local dirs needed
}

// Convert Prisma listing to legacy format for API responses
export function toLegacyListing(listing: ListingWithPhotos): LegacyListing {
  const photos: Record<string, PhotoMeta> = {};
  const photoIds: string[] = [];

  // Sort photos by sortOrder
  const sortedPhotos = [...listing.photos].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const photo of sortedPhotos) {
    photoIds.push(photo.id);
    photos[photo.id] = {
      id: photo.id,
      listingId: photo.listingId,
      originalName: photo.originalName,
      filename: photo.filename,
      mime: photo.mime,
      ext: photo.ext,
      sortOrder: photo.sortOrder,
      excluded: photo.excluded,
      createdAt: photo.createdAt,
    };
  }

  return {
    id: listing.id,
    title: listing.title,
    address: listing.address,
    sanitizedAddress: listing.sanitizedAddress,
    status: listing.status,
    userId: listing.userId,
    photoIds,
    photos,
    createdAt: listing.createdAt.getTime(),
    updatedAt: listing.updatedAt.getTime(),
  };
}

export async function createListing(input: {
  address: string;
  title?: string;
  userId: string;
}): Promise<LegacyListing> {
  await ensureDataDirs();

  const address = (input.address || "").trim();
  const sanitizedAddr = sanitizeAddress(address);

  const listing = await prisma.listing.create({
    data: {
      address,
      sanitizedAddress: sanitizedAddr,
      title: input.title || "Collection",
      userId: input.userId,
    },
    include: {
      photos: true,
    },
  });

  return toLegacyListing(listing);
}

export async function getListingById(id: string): Promise<LegacyListing | null> {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!listing) return null;
  return toLegacyListing(listing);
}

export async function getListingWithUser(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
      user: true,
    },
  });
}

export async function updateListing(
  id: string,
  patch: Partial<{ address: string; title: string; photoIds: string[]; status: "DRAFT" | "SUBMITTED" | "APPROVED" }>
): Promise<LegacyListing | null> {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { photos: true },
  });

  if (!listing) return null;

  // Build update data — always bump updatedAt so polling detects changes
  const updateData: {
    address?: string;
    sanitizedAddress?: string;
    title?: string;
    status?: "DRAFT" | "SUBMITTED" | "APPROVED";
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (typeof patch.title === "string") {
    updateData.title = patch.title;
  }

  if (typeof patch.address === "string") {
    updateData.address = patch.address.trim();
    updateData.sanitizedAddress = sanitizeAddress(updateData.address);
  }

  if (patch.status) {
    updateData.status = patch.status;
  }

  // Update photo order if photoIds provided
  if (Array.isArray(patch.photoIds)) {
    // Update sortOrder for each photo based on its position in the array
    const updates = patch.photoIds.map((photoId, index) =>
      prisma.photo.update({
        where: { id: photoId },
        data: { sortOrder: index },
      })
    );
    await prisma.$transaction(updates);
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: updateData,
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return toLegacyListing(updated);
}

export async function addPhotoToListing(args: {
  listingId: string;
  buffer: Buffer;
  originalName: string;
  mime: string;
}): Promise<{ photo: PhotoMeta }> {
  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
    include: { photos: true },
  });

  if (!listing) throw new Error("Listing not found");

  await ensureDataDirs();

  const ext = guessExt(args.originalName, args.mime);

  // Determine sort order (add to end)
  const maxSortOrder = listing.photos.reduce(
    (max, p) => Math.max(max, p.sortOrder),
    -1
  );

  // Create photo record first to get ID
  const photo = await prisma.photo.create({
    data: {
      listingId: args.listingId,
      originalName: args.originalName,
      filename: "", // Will update after we know the ID
      mime: args.mime,
      ext,
      sortOrder: maxSortOrder + 1,
    },
  });

  // Update filename with photo ID
  const storedName = `${photo.id}.${ext}`;
  const thumbName = `${photo.id}_thumb.jpg`;

  await prisma.photo.update({
    where: { id: photo.id },
    data: { filename: storedName },
  });

  // Upload original and generate+upload thumbnail in parallel
  const thumbPromise = sharp(args.buffer)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "center" })
    .jpeg({ quality: 80 })
    .toBuffer()
    .then((thumbBuffer) => uploadThumbnail(args.listingId, photo.id, thumbBuffer))
    .catch((err) => console.error("Failed to generate thumbnail:", err));

  await Promise.all([
    uploadOriginal(args.listingId, photo.id, ext, args.buffer),
    thumbPromise,
    // Bump listing updatedAt so polling detects the new photo
    prisma.listing.update({
      where: { id: args.listingId },
      data: { updatedAt: new Date() },
    }),
  ]);

  const photoMeta: PhotoMeta = {
    id: photo.id,
    listingId: photo.listingId,
    originalName: photo.originalName,
    filename: storedName,
    mime: photo.mime,
    ext: photo.ext,
    sortOrder: photo.sortOrder,
    excluded: photo.excluded,
    createdAt: photo.createdAt,
  };

  return { photo: photoMeta };
}

export async function getPhotoFile(listingId: string, photoId: string, thumbnail = false) {
  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      listingId,
    },
  });

  if (!photo) return null;

  if (thumbnail) {
    const blobPath = blobPathThumb(listingId, photoId);
    return { blobPath, meta: photo, isThumbnail: true };
  }

  const blobPath = blobPathOriginal(listingId, photoId, photo.ext);
  return { blobPath, meta: photo, isThumbnail: false };
}

export async function deletePhotoFromListing(listingId: string, photoId: string): Promise<LegacyListing | null> {
  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      listingId,
    },
  });

  if (!photo) {
    const listing = await getListingById(listingId);
    return listing;
  }

  // Delete from Azure Blob
  try {
    await deleteBlob(blobPathOriginal(listingId, photoId, photo.ext));
  } catch {}
  try {
    await deleteBlob(blobPathThumb(listingId, photoId));
  } catch {}

  // Delete from database
  await prisma.photo.delete({
    where: { id: photoId },
  });

  return getListingById(listingId);
}

export async function togglePhotoExcluded(listingId: string, photoId: string): Promise<PhotoMeta | null> {
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, listingId },
    select: { id: true, excluded: true },
  });

  if (!photo) return null;

  // Toggle the photo and bump the listing's updatedAt so polling detects the change
  const [updated] = await prisma.$transaction([
    prisma.photo.update({
      where: { id: photoId },
      data: { excluded: !photo.excluded },
    }),
    prisma.listing.update({
      where: { id: listingId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return {
    id: updated.id,
    listingId: updated.listingId,
    originalName: updated.originalName,
    filename: updated.filename,
    mime: updated.mime,
    ext: updated.ext,
    sortOrder: updated.sortOrder,
    excluded: updated.excluded,
    createdAt: updated.createdAt,
  };
}

// User queries
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function getUserByOktaId(oktaId: string) {
  return prisma.user.findUnique({
    where: { oktaId },
  });
}

export async function createUser(data: {
  email: string;
  name?: string;
  oktaId?: string;
  role?: "ADVISOR" | "LISTINGS" | "ADMIN";
}) {
  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      oktaId: data.oktaId,
      role: data.role || "ADVISOR",
    },
  });
}

export async function upsertUserByOktaId(data: {
  email: string;
  name?: string;
  oktaId: string;
}) {
  return prisma.user.upsert({
    where: { oktaId: data.oktaId },
    update: {
      email: data.email,
      name: data.name,
    },
    create: {
      email: data.email,
      name: data.name,
      oktaId: data.oktaId,
      role: "ADVISOR",
    },
  });
}

// Listing queries for dashboard
export async function getListingsByUserId(userId: string) {
  const listings = await prisma.listing.findMany({
    where: { userId },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return listings.map(toLegacyListing);
}

export async function getAllListings(options?: {
  status?: "DRAFT" | "SUBMITTED" | "APPROVED";
  limit?: number;
  offset?: number;
  search?: string;
}) {
  const where: {
    status?: "DRAFT" | "SUBMITTED" | "APPROVED";
    address?: { contains: string };
  } = {};

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.search) {
    where.address = { contains: options.search };
  }

  const listings = await prisma.listing.findMany({
    where,
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
      user: true,
      collaborators: {
        select: { id: true, name: true, email: true },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: options?.limit,
    skip: options?.offset,
  });

  return listings;
}

export async function countListings(options?: {
  status?: "DRAFT" | "SUBMITTED" | "APPROVED";
  search?: string;
}) {
  const where: {
    status?: "DRAFT" | "SUBMITTED" | "APPROVED";
    address?: { contains: string };
  } = {};

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.search) {
    where.address = { contains: options.search };
  }

  return prisma.listing.count({ where });
}

export async function deleteListing(id: string) {
  // Get photos to delete files
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { photos: true },
  });

  if (!listing) return null;

  // Delete photos from Azure Blob
  for (const photo of listing.photos) {
    try {
      await deleteBlob(blobPathOriginal(id, photo.id, photo.ext));
    } catch {}
    try {
      await deleteBlob(blobPathThumb(id, photo.id));
    } catch {}
  }

  // Delete from database (photos will cascade)
  await prisma.listing.delete({
    where: { id },
  });

  return listing;
}

// Cleanup old listings
export async function getOldListings(daysOld: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return prisma.listing.findMany({
    where: {
      updatedAt: {
        lt: cutoff,
      },
    },
    include: {
      photos: true,
    },
  });
}

// Get users with LISTINGS or ADMIN role for notifications
export async function getListingsTeamMembers() {
  return prisma.user.findMany({
    where: {
      role: {
        in: ["LISTINGS", "ADMIN"],
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
}

// Get all users with ADVISOR role
export async function getAdvisors() {
  return prisma.user.findMany({
    where: { role: "ADVISOR" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
}

// --- PhotoOrderSubmission store functions ---

function toSubmissionData(record: {
  id: string;
  listingId: string;
  initiatorRole: string;
  approverRole: string;
  status: string;
  orderedPhotoIds: string;
  note: string | null;
  submittedByUserId: string;
  approvedByUserId: string | null;
  proposedToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date;
  approvedAt: Date | null;
}): PhotoOrderSubmissionData {
  return {
    ...record,
    initiatorRole: record.initiatorRole as Role,
    approverRole: record.approverRole as Role,
    status: record.status as SubmissionStatus,
    orderedPhotoIds: JSON.parse(record.orderedPhotoIds) as string[],
  };
}

export async function createSubmission(input: {
  listingId: string;
  initiatorRole: Role;
  approverRole: Role;
  orderedPhotoIds: string[];
  submittedByUserId: string;
  note?: string;
  proposedToUserId?: string;
}): Promise<PhotoOrderSubmissionData> {
  const record = await prisma.photoOrderSubmission.create({
    data: {
      listingId: input.listingId,
      initiatorRole: input.initiatorRole,
      approverRole: input.approverRole,
      status: "SUBMITTED",
      orderedPhotoIds: JSON.stringify(input.orderedPhotoIds),
      submittedByUserId: input.submittedByUserId,
      note: input.note,
      proposedToUserId: input.proposedToUserId,
    },
  });
  return toSubmissionData(record);
}

export async function getSubmissionById(id: string): Promise<PhotoOrderSubmissionData | null> {
  const record = await prisma.photoOrderSubmission.findUnique({ where: { id } });
  if (!record) return null;
  return toSubmissionData(record);
}

export async function getLatestSubmissionForListing(
  listingId: string,
  filters?: { status?: SubmissionStatus | SubmissionStatus[] }
): Promise<PhotoOrderSubmissionData | null> {
  const where: { listingId: string; status?: SubmissionStatus | { in: SubmissionStatus[] } } = { listingId };
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status };
    } else {
      where.status = filters.status;
    }
  }

  const record = await prisma.photoOrderSubmission.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (!record) return null;
  return toSubmissionData(record);
}

export async function approveSubmission(
  id: string,
  approvedByUserId: string,
  note?: string
): Promise<PhotoOrderSubmissionData> {
  const submissionData: { status: "APPROVED"; approvedByUserId: string; approvedAt: Date; note?: string } = {
    status: "APPROVED",
    approvedByUserId,
    approvedAt: new Date(),
  };
  if (note !== undefined) submissionData.note = note;

  const record = await prisma.photoOrderSubmission.update({
    where: { id },
    data: submissionData,
  });

  // Also update the listing status to APPROVED
  await prisma.listing.update({
    where: { id: record.listingId },
    data: { status: "APPROVED" },
  });

  return toSubmissionData(record);
}

export async function requestChangesOnSubmission(
  id: string,
  note?: string
): Promise<PhotoOrderSubmissionData> {
  const data: { status: "CHANGES_REQUESTED"; note?: string } = { status: "CHANGES_REQUESTED" };
  if (note !== undefined) data.note = note;
  const record = await prisma.photoOrderSubmission.update({
    where: { id },
    data,
  });
  return toSubmissionData(record);
}

export async function getListingsProposedToUser(userId: string): Promise<LegacyListing[]> {
  // Get distinct listing IDs proposed to this user (avoids fetching duplicate listing+photo data)
  const submissions = await prisma.photoOrderSubmission.findMany({
    where: { proposedToUserId: userId },
    distinct: ["listingId"],
    select: { listingId: true },
    orderBy: { createdAt: "desc" },
  });

  if (submissions.length === 0) return [];

  const listingIds = submissions.map((s) => s.listingId);

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return listings.map(toLegacyListing);
}

export async function hasProposalForUser(listingId: string, userId: string): Promise<boolean> {
  const count = await prisma.photoOrderSubmission.count({
    where: {
      listingId,
      proposedToUserId: userId,
    },
  });
  return count > 0;
}

// --- Listing Collaborator functions ---

export async function isListingCollaborator(listingId: string, userId: string): Promise<boolean> {
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      collaborators: { some: { id: userId } },
    },
    select: { id: true },
  });
  return listing !== null;
}

export async function addCollaboratorsToListing(listingId: string, userIds: string[]): Promise<void> {
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      collaborators: {
        connect: userIds.map((id) => ({ id })),
      },
    },
  });
}

export async function getListingCollaborators(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      collaborators: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });
  return listing?.collaborators ?? [];
}

export async function getCollaboratedListings(userId: string): Promise<LegacyListing[]> {
  const listings = await prisma.listing.findMany({
    where: {
      collaborators: { some: { id: userId } },
    },
    include: {
      photos: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return listings.map(toLegacyListing);
}

/** Check if user has access to a listing via ownership, collaborator, or proposal */
export async function hasListingAccess(listingId: string, userId: string): Promise<boolean> {
  // Check collaborator first (cheaper than scanning submissions)
  if (await isListingCollaborator(listingId, userId)) return true;
  // Fall back to proposal check for backward compat
  return hasProposalForUser(listingId, userId);
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
