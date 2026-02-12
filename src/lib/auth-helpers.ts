import { auth } from "@/auth";
import { upsertUserByOktaId, getUserByOktaId } from "@/lib/store";
import type { Role } from "@/lib/types";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  oktaId: string;
}

/**
 * Get the authenticated user from the session and ensure they exist in our database.
 * This should be used in API routes instead of directly using auth().
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();

  if (!session?.user?.oktaId || !session.user.email) {
    return null;
  }

  // Ensure the user exists in our database
  const dbUser = await upsertUserByOktaId({
    email: session.user.email,
    name: session.user.name || undefined,
    oktaId: session.user.oktaId,
  });

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as Role,
    oktaId: dbUser.oktaId || session.user.oktaId,
  };
}

/**
 * Check if the current user has a specific role
 */
export async function checkUserRole(allowedRoles: Role[]): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return user;
}
