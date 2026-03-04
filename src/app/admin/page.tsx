"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ListingShell from "@/components/ListingsShell";
import StatusBadge from "@/components/StatusBadge";
import { useUser } from "@/components/UserProvider";
import type { ListingWithPhotosAndUser } from "@/lib/types";

type PendingListing = ListingWithPhotosAndUser & {
  submissions?: { approverRole: string; status: string }[];
};

export default function AdminDashboardPage() {
  const { user } = useUser();
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    total: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch pending submissions
      const pendingRes = await fetch("/api/listings?all=true&status=SUBMITTED&limit=10");
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingListings(data.listings || []);
        setStats((prev) => ({ ...prev, pending: data.total || 0 }));
      }

      // Fetch stats
      const [approvedRes, totalRes] = await Promise.all([
        fetch("/api/listings?all=true&status=APPROVED&limit=0"),
        fetch("/api/listings?all=true&limit=0"),
      ]);

      if (approvedRes.ok) {
        const data = await approvedRes.json();
        setStats((prev) => ({ ...prev, approved: data.total || 0 }));
      }

      if (totalRes.ok) {
        const data = await totalRes.json();
        setStats((prev) => ({ ...prev, total: data.total || 0 }));
      }

      // Fetch user count (ADMIN only)
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const users = await usersRes.json();
        setStats((prev) => ({ ...prev, users: users.length || 0 }));
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ListingShell title="Admin Dashboard">
      <div className="p-3 md:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back, {user?.name || "Admin"}
          </p>
        </div>

        {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl md:text-2xl text-amber-600">
                    pending
                  </span>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    Pending
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? "-" : stats.pending}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl md:text-2xl text-green-600">
                    check_circle
                  </span>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    Approved
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? "-" : stats.approved}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl md:text-2xl text-blue-600">
                    photo_library
                  </span>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    Total
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? "-" : stats.total}
                  </p>
                </div>
              </div>
            </div>

            {user?.role === "ADMIN" && (
              <Link
                href="/admin/users"
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 hover:border-purple-300 dark:hover:border-purple-600 transition-colors group cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-xl md:text-2xl text-purple-600">
                      group
                    </span>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      Users
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                      {loading ? "-" : stats.users}
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Pending Submissions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending Submissions
              </h2>
              <Link
                href="/admin/submissions"
                className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium"
              >
                View All
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : pendingListings.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-gray-300">
                  inbox
                </span>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  No pending submissions
                </p>
              </div>
            ) : (
              <>
              {/* Mobile: Card layout */}
              <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {pendingListings.map((listing) => {
                  const sub = listing.submissions?.[0];
                  const isPendingAdvisor = sub?.status === "SUBMITTED" && sub?.approverRole === "ADVISOR";
                  return (
                    <Link
                      key={listing.id}
                      href={`/admin/submissions/${listing.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {listing.address}
                          </p>
                          {isPendingAdvisor && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                              <span className="material-symbols-outlined text-xs">hourglass_top</span>
                              Advisor
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {listing.user?.name || listing.user?.email || "Unknown"} &middot; {listing.photos.filter((p) => !p.excluded).length} photos &middot; {new Date(listing.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 text-xl shrink-0">chevron_right</span>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop: Table layout */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Submitted By
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Photos
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pendingListings.map((listing) => {
                    const sub = listing.submissions?.[0];
                    const isPendingAdvisor = sub?.status === "SUBMITTED" && sub?.approverRole === "ADVISOR";
                    return (
                      <tr
                        key={listing.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {listing.address}
                            </span>
                            {isPendingAdvisor && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <span className="material-symbols-outlined text-xs">hourglass_top</span>
                                Pending Advisor
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {listing.user?.name || listing.user?.email || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {listing.photos.filter((p) => !p.excluded).length}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(listing.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/submissions/${listing.id}`}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>
    </ListingShell>
  );
}
