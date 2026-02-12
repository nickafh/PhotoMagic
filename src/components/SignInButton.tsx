"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useUser } from "./UserProvider";

export function SignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <button
        disabled
        className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg"
      >
        Loading...
      </button>
    );
  }

  if (session) {
    return (
      <button
        onClick={() => signOut()}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      onClick={() => signIn("okta")}
      className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
    >
      Sign In
    </button>
  );
}

export function UserMenu() {
  const { data: session, status } = useSession();
  const { user, loading: userLoading } = useUser();

  if (status === "loading" || userLoading) {
    return (
      <div className="flex items-center gap-3 p-3 animate-pulse">
        <div className="w-10 h-10 bg-gray-300 rounded-full" />
        <div className="space-y-1">
          <div className="h-4 w-20 bg-gray-300 rounded" />
          <div className="h-3 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-3">
        <button
          onClick={() => signIn("okta")}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  const displayName = user?.name || session.user.name;
  const displayEmail = user?.email || session.user.email;
  const displayRole = user?.role || "ADVISOR";

  const initials = displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || displayEmail?.[0]?.toUpperCase() || "?";

  const roleLabel = {
    ADVISOR: "Advisor",
    LISTINGS: "Listings Team",
    ADMIN: "Administrator",
  }[displayRole] || "User";

  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-semibold text-sm">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {displayName || displayEmail}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {roleLabel}
        </p>
      </div>
      <button
        onClick={() => signOut()}
        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="Sign out"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  );
}
