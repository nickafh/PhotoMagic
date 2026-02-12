"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserMenu } from "./SignInButton";
import { useUser } from "./UserProvider";
import type { LegacyListing } from "@/lib/types";

interface SidebarProps {
  listings?: LegacyListing[];
}

export default function Sidebar({ listings = [] }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const isAdmin = user?.role === "LISTINGS" || user?.role === "ADMIN";
  const canManageUsers = user?.role === "ADMIN";

  return (
    <aside className="w-64 h-screen bg-primary text-white flex flex-col fixed top-0 left-0 z-30">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%23ffffff&quot; fill-opacity=&quot;1&quot;%3E%3Cpath d=&quot;M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />

      {/* Logo section - fixed at top */}
      <div className="relative p-6 pb-0">
        <Link href="/dashboard" className="flex items-center gap-3 mb-6 group">
          <Image
            src="/brand/Atlanta Fine Homes_Horz_White.png"
            alt="Atlanta Fine Homes"
            width={180}
            height={32}
            className="transition-opacity group-hover:opacity-90"
            style={{ height: "32px", width: "auto" }}
            priority
          />
        </Link>
      </div>

      {/* Scrollable navigation area */}
      <div className="relative flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
        <nav className="space-y-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === "/dashboard"
                ? "bg-white/10 text-white shadow-sm"
                : "hover:bg-white/5 text-white/70 hover:text-white"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={pathname === "/dashboard" ? { fontVariationSettings: '"FILL" 1' } : undefined}
            >
              grid_view
            </span>
            <span className="font-medium">My Listings</span>
          </Link>

          {listings.length > 0 && (
            <>
              <div className="pt-5 pb-2 text-[10px] font-bold uppercase tracking-widest text-gold/70 px-3">
                Recent
              </div>
              {listings.map((listing) => {
                const isActive = pathname === `/listing/${listing.id}`;
                return (
                  <Link
                    key={listing.id}
                    href={`/listing/${listing.id}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "hover:bg-white/5 text-white/60 hover:text-white"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-lg"
                      style={isActive ? { fontVariationSettings: '"FILL" 1' } : undefined}
                    >
                      home
                    </span>
                    <span className="text-sm truncate flex-1">
                      {listing.address}
                    </span>
                  </Link>
                );
              })}
            </>
          )}

          {isAdmin && (
            <>
              <div className="pt-6 pb-2 text-[10px] font-bold uppercase tracking-widest text-gold/70 px-3">
                Admin
              </div>

              <Link
                href="/dashboard/listings"
                prefetch={false}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  pathname === "/dashboard/listings"
                    ? "bg-white/10 text-white shadow-sm"
                    : "hover:bg-white/5 text-white/70 hover:text-white"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={pathname === "/dashboard/listings" ? { fontVariationSettings: '"FILL" 1' } : undefined}
                >
                  list_alt
                </span>
                <span className="font-medium">All Listings</span>
              </Link>

              <Link
                href="/admin"
                prefetch={false}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  pathname === "/admin" || pathname.startsWith("/admin/submissions")
                    ? "bg-white/10 text-white shadow-sm"
                    : "hover:bg-white/5 text-white/70 hover:text-white"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={pathname === "/admin" || pathname.startsWith("/admin/submissions") ? { fontVariationSettings: '"FILL" 1' } : undefined}
                >
                  admin_panel_settings
                </span>
                <span className="font-medium">Admin Dashboard</span>
              </Link>

              {canManageUsers && (
                <Link
                  href="/admin/users"
                  prefetch={false}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    pathname === "/admin/users"
                      ? "bg-white/10 text-white shadow-sm"
                      : "hover:bg-white/5 text-white/70 hover:text-white"
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={pathname === "/admin/users" ? { fontVariationSettings: '"FILL" 1' } : undefined}
                  >
                    group
                  </span>
                  <span className="font-medium">Manage Users</span>
                </Link>
              )}
            </>
          )}
        </nav>
      </div>

      {/* User menu - fixed at bottom */}
      <div className="relative border-t border-white/10 shrink-0">
        <UserMenu />
      </div>
    </aside>
  );
}
