"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ListingShell from "@/components/ListingsShell";
import StatusBadge from "@/components/StatusBadge";
import type { ListingWithPhotosAndUser } from "@/lib/types";

export default function SubmissionsPage() {
  const [listings, setListings] = useState<ListingWithPhotosAndUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const res = await fetch("/api/listings?all=true&status=SUBMITTED");
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ListingShell title="Submissions">
      <div className="p-3 md:p-8">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <Link
            href="/admin"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pending Submissions
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {total} submission{total !== 1 ? "s" : ""} awaiting review
            </p>
          </div>
        </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="material-symbols-outlined text-5xl text-gray-300">
                inbox
              </span>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-lg">
                No pending submissions
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                All submissions have been reviewed
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-6 hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shrink-0">
                    {listing.photos.length > 0 ? (
                      <img
                        src={`/api/photos/${listing.photos[0].id}?listingId=${listing.id}&thumb=1`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-gray-300">
                          photo_library
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg truncate">
                      {listing.address}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">
                          person
                        </span>
                        {listing.user?.name || listing.user?.email || "Unknown"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">
                          photo
                        </span>
                        {listing.photos.filter((p) => !p.excluded).length} photos
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">
                          schedule
                        </span>
                        {new Date(listing.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <Link
                    href={`/admin/submissions/${listing.id}`}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors shrink-0"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
    </ListingShell>
  );
}
