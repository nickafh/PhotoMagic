// Role and ListingStatus enums - duplicated from Prisma to avoid Edge runtime issues
export type Role = "ADVISOR" | "LISTINGS" | "ADMIN";
export type ListingStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

// Re-export Prisma types for server-side use (avoid in middleware/edge)
export type { User, Listing, Photo } from "@/generated/prisma/client";

// Extended types with relations
import type { Listing as PrismaListing, Photo as PrismaPhoto, User as PrismaUser } from "@/generated/prisma/client";

export type ListingWithPhotos = PrismaListing & {
  photos: PrismaPhoto[];
};

export type ListingWithPhotosAndUser = PrismaListing & {
  photos: PrismaPhoto[];
  user: PrismaUser;
};

export type UserWithListings = PrismaUser & {
  listings: PrismaListing[];
};

// Legacy PhotoMeta type for backwards compatibility during migration
export type PhotoMeta = {
  id: string;
  listingId: string;
  originalName: string;
  filename: string;
  mime: string;
  ext: string;
  sortOrder: number;
  excluded: boolean;
  createdAt: Date;
};

// Legacy Listing type for API responses (flattened)
export type LegacyListing = {
  id: string;
  title: string;
  address: string;
  sanitizedAddress: string;
  status: string;
  userId: string;
  photoIds: string[];
  photos: Record<string, PhotoMeta>;
  createdAt: number;
  updatedAt: number;
};
