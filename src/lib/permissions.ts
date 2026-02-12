import type { Role } from "@/lib/types";
import type { Session } from "next-auth";

/**
 * Role Capabilities:
 *
 * | Role     | Own Listings | All Listings | Approve | Download | Manage Users |
 * |----------|-------------|--------------|---------|----------|--------------|
 * | ADVISOR  | CRUD, Submit| -            | -       | Own      | -            |
 * | LISTINGS | CRUD, Submit| View         | Yes     | Any      | -            |
 * | ADMIN    | CRUD, Submit| View, Delete | Yes     | Any      | Yes          |
 */

export type Permission =
  | "listing:create"
  | "listing:read"
  | "listing:update"
  | "listing:delete"
  | "listing:submit"
  | "listing:read_all"
  | "listing:delete_all"
  | "listing:approve"
  | "listing:reorder_submitted"
  | "download:own"
  | "download:any"
  | "user:manage";

const rolePermissions: Record<Role, Permission[]> = {
  ADVISOR: [
    "listing:create",
    "listing:read",
    "listing:update",
    "listing:delete",
    "listing:submit",
    "download:own",
  ],
  LISTINGS: [
    "listing:create",
    "listing:read",
    "listing:update",
    "listing:delete",
    "listing:submit",
    "listing:read_all",
    "listing:approve",
    "listing:reorder_submitted",
    "download:own",
    "download:any",
  ],
  ADMIN: [
    "listing:create",
    "listing:read",
    "listing:update",
    "listing:delete",
    "listing:submit",
    "listing:read_all",
    "listing:delete_all",
    "listing:approve",
    "listing:reorder_submitted",
    "download:own",
    "download:any",
    "user:manage",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function getPermissions(role: Role): Permission[] {
  return rolePermissions[role] || [];
}

// Session-based helpers
export function canAccessListing(
  session: Session | null,
  listingUserId: string
): boolean {
  if (!session?.user) return false;

  const role = session.user.role;

  // Own listing
  if (session.user.id === listingUserId) {
    return hasPermission(role, "listing:read");
  }

  // Other's listing
  return hasPermission(role, "listing:read_all");
}

export function canModifyListing(
  session: Session | null,
  listingUserId: string
): boolean {
  if (!session?.user) return false;

  const role = session.user.role;

  // Only owner can modify, unless admin
  if (session.user.id === listingUserId) {
    return hasPermission(role, "listing:update");
  }

  // Admins can modify any listing
  return role === "ADMIN";
}

export function canDeleteListing(
  session: Session | null,
  listingUserId: string
): boolean {
  if (!session?.user) return false;

  const role = session.user.role;

  // Own listing
  if (session.user.id === listingUserId) {
    return hasPermission(role, "listing:delete");
  }

  // Other's listing - only admin
  return hasPermission(role, "listing:delete_all");
}

export function canDownloadListing(
  session: Session | null,
  listingUserId: string
): boolean {
  if (!session?.user) return false;

  const role = session.user.role;

  // Own listing
  if (session.user.id === listingUserId) {
    return hasPermission(role, "download:own");
  }

  // Other's listing
  return hasPermission(role, "download:any");
}

export function canApproveListing(session: Session | null): boolean {
  if (!session?.user) return false;
  return hasPermission(session.user.role, "listing:approve");
}

export function canManageUsers(session: Session | null): boolean {
  if (!session?.user) return false;
  return hasPermission(session.user.role, "user:manage");
}

export function isListingsTeamOrAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  return session.user.role === "LISTINGS" || session.user.role === "ADMIN";
}

export function isAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  return session.user.role === "ADMIN";
}

/**
 * Check if user can reorder photos in a listing
 * - DRAFT: Anyone with listing:update can reorder
 * - SUBMITTED/APPROVED: Only users with listing:reorder_submitted can reorder
 */
export function canReorderListing(
  session: Session | null,
  listingUserId: string,
  listingStatus: "DRAFT" | "SUBMITTED" | "APPROVED"
): boolean {
  if (!session?.user) return false;

  const role = session.user.role;
  const isOwner = session.user.id === listingUserId;

  // For DRAFT listings, owner can reorder
  if (listingStatus === "DRAFT") {
    return isOwner && hasPermission(role, "listing:update");
  }

  // For SUBMITTED/APPROVED, only LISTINGS/ADMIN can reorder
  return hasPermission(role, "listing:reorder_submitted");
}
