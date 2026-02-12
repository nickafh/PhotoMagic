"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import ListingShell from "@/components/ListingsShell";
import StatusBadge from "@/components/StatusBadge";
import type { LegacyListing } from "@/lib/types";

export default function ReviewSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [listing, setListing] = useState<LegacyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchListing = useCallback(async () => {
    try {
      const res = await fetch(`/api/listings/${id}`);
      if (res.ok) {
        const data = await res.json();
        setListing(data);
      } else if (res.status === 404) {
        router.push("/admin/submissions");
      }
    } catch (error) {
      console.error("Failed to fetch listing:", error);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) {
      fetchListing();
    }
  }, [id, fetchListing]);

  async function handleApprove() {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      if (res.ok) {
        await fetchListing();
        toast.success("Listing approved.");
      } else {
        toast.error("Failed to approve listing");
      }
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Failed to approve listing");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/listings/${id}/downloads`);
      if (!res.ok) {
        throw new Error("Download failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${listing?.sanitizedAddress || "listing"}_photos.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download photos");
    } finally {
      setIsDownloading(false);
    }
  }

  if (loading || !listing) {
    return (
      <ListingShell title="Submission">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </ListingShell>
    );
  }

  const activePhotos = listing.photoIds.filter(
    (pid) => !listing.photos[pid]?.excluded
  );
  const excludedPhotos = listing.photoIds.filter(
    (pid) => listing.photos[pid]?.excluded
  );

  return (
    <ListingShell title={listing.address}>
      <div className="p-3 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 md:mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/submissions"
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {listing.address}
                  </h1>
                  <StatusBadge status={listing.status} size="md" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  {activePhotos.length} photo{activePhotos.length !== 1 ? "s" : ""} selected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">download</span>
                    Download ZIP
                  </>
                )}
              </button>

              {listing.status === "SUBMITTED" && (
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">check_circle</span>
                      Approve
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Photo Grid */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Photos ({activePhotos.length})
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {activePhotos.map((photoId, idx) => (
                <div
                  key={photoId}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
                >
                  <img
                    src={`/api/photos/${photoId}?listingId=${listing.id}&thumb=1`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>

            {/* Excluded Photos */}
            {excludedPhotos.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-medium text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">hide_image</span>
                  Do Not Use ({excludedPhotos.length})
                </h3>

                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-3">
                  {excludedPhotos.map((photoId) => (
                    <div
                      key={photoId}
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 opacity-50"
                    >
                      <img
                        src={`/api/photos/${photoId}?listingId=${listing.id}&thumb=1`}
                        alt=""
                        className="w-full h-full object-cover grayscale"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
    </ListingShell>
  );
}
