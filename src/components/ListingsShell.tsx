"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
import type { LegacyListing } from "@/lib/types";

export default function ListingShell({
  title,
  status,
  actions,
  mobileActions,
  children,
}: {
  title: string;
  status?: "DRAFT" | "SUBMITTED" | "APPROVED";
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { status: authStatus } = useSession();
  const [recentListings, setRecentListings] = useState<LegacyListing[]>([]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetch("/api/listings")
        .then((res) => res.json())
        .then((data) => {
          setRecentListings((data.listings || []).slice(0, 5));
        })
        .catch(console.error);
    }
  }, [authStatus]);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar - fixed position, hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar listings={recentListings} />
      </div>

      {/* Mobile Header */}
      <MobileHeader title={title} status={status} />

      {/* Main content with left margin for fixed sidebar on desktop */}
      <main className="flex flex-col min-h-screen md:ml-64">
        {/* Desktop Topbar - hidden on mobile */}
        <div className="hidden md:block">
          <Topbar title={title} />
        </div>

        {/* Desktop Actions Bar */}
        <div className="hidden md:flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-4 items-center justify-end z-10 shrink-0 gap-4">
          {actions}
        </div>

        {/* Mobile Subheader */}
        {status && (
          <div className="md:hidden px-4 py-2 bg-white dark:bg-[#121B26] border-b border-gray-200 dark:border-gray-800">
            <span className="text-[10px] font-bold text-text-grey dark:text-gray-400 tracking-wider uppercase">
              {/* Photo count will be passed via children or context */}
            </span>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-8 pb-36 md:pb-8 custom-scrollbar">
          <div className="animate-fade-in">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Actions */}
        {mobileActions && (
          <div className="md:hidden fixed bottom-14 left-0 right-0 p-3 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            {mobileActions}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
