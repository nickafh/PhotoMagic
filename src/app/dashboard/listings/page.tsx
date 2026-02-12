"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ListingShell from "@/components/ListingsShell";
import StatusBadge from "@/components/StatusBadge";
import type { ListingWithPhotosAndUser } from "@/lib/types";
import { Suspense } from "react";

function AllListingsContent() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<ListingWithPhotosAndUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || ""
  );

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    // Check if user has permission
    if (
      authStatus === "authenticated" &&
      session?.user?.role !== "LISTINGS" &&
      session?.user?.role !== "ADMIN"
    ) {
      router.push("/dashboard");
      return;
    }

    if (authStatus === "authenticated") {
      fetchListings();
    }
  }, [authStatus, session, statusFilter, searchParams]);

  async function fetchListings() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/listings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch listings:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchListings();
  }

  if (authStatus === "loading") {
    return (
      <ListingShell title="All Listings">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </ListingShell>
    );
  }

  return (
    <ListingShell title="All Listings">
      <div className="p-3 md:p-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              All Listings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {total} listing{total !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by address..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  search
                </span>
              </div>
            </form>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>

          {/* Listings Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-300">
                search_off
              </span>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                No listings found
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Photos
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {listings.map((listing) => (
                    <tr
                      key={listing.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/listing/${listing.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400"
                        >
                          {listing.address}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {listing.user?.name || listing.user?.email || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {listing.photos.filter((p) => !p.excluded).length}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={listing.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(listing.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/listing/${listing.id}`}
                          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </ListingShell>
  );
}

export default function AllListingsPage() {
  return (
    <Suspense
      fallback={
        <ListingShell title="All Listings">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        </ListingShell>
      }
    >
      <AllListingsContent />
    </Suspense>
  );
}
