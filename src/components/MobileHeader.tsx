"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useUser } from "@/components/UserProvider";
import StatusBadge from "./StatusBadge";

type MobileHeaderProps = {
  title: string;
  status?: "DRAFT" | "SUBMITTED" | "APPROVED";
  onMenuToggle?: () => void;
};

export default function MobileHeader({ title, status }: MobileHeaderProps) {
  const { data: session } = useSession();
  const { user } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const isAdmin = user?.role === "LISTINGS" || user?.role === "ADMIN";

  return (
    <>
      <header className="md:hidden sticky top-0 z-50 bg-primary px-4 py-3.5">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-white/90 hover:text-white transition-colors p-1 -ml-1"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
            <h1 className="text-lg font-display text-white tracking-wide truncate max-w-[180px]">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {status && <StatusBadge status={status} size="sm" />}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMenu && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowMenu(false)}
          />

          {/* Drawer - ~75–80% width on mobile, matches desktop sidebar content */}
          <div className="absolute left-0 top-0 bottom-0 w-[min(320px,85vw)] max-w-[320px] bg-primary shadow-2xl animate-slide-in-left flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-gold text-lg">home_work</span>
                  </div>
                  <span className="text-white font-display text-xl tracking-wide">PhotoMagic</span>
                </div>
                <button
                  onClick={() => setShowMenu(false)}
                  className="text-white/50 hover:text-white transition-colors p-1"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              {session?.user && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white/70">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/90 text-sm font-medium leading-tight truncate">
                      {session.user.name || "User"}
                    </p>
                    <p className="text-white/50 text-xs leading-tight truncate">
                      {session.user.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation - matches desktop sidebar: My Listings, All Listings, Admin */}
            <nav className="p-3 space-y-1 flex-1 min-h-0 overflow-y-auto pb-24">
              <NavLink
                href="/dashboard"
                icon="grid_view"
                label="My Listings"
                onClick={() => setShowMenu(false)}
              />
              {isAdmin && (
                <>
                  <NavLink
                    href="/dashboard/listings"
                    icon="list_alt"
                    label="All Listings"
                    onClick={() => setShowMenu(false)}
                  />
                  <NavLink
                    href="/admin"
                    icon="admin_panel_settings"
                    label="Admin Dashboard"
                    onClick={() => setShowMenu(false)}
                  />
                  <NavLink
                    href="/admin/submissions"
                    icon="pending_actions"
                    label="Submissions"
                    onClick={() => setShowMenu(false)}
                  />
                  <NavLink
                    href="/admin/users"
                    icon="group"
                    label="Manage Users"
                    onClick={() => setShowMenu(false)}
                  />
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-black/10">
              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 text-white/60 hover:text-white w-full py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 text-white/80 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors"
    >
      <span className="material-symbols-outlined text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
