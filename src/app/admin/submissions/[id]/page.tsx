"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import ListingShell from "@/components/ListingsShell";
import StatusBadge from "@/components/StatusBadge";
import type { LegacyListing, PhotoOrderSubmissionData } from "@/lib/types";

export default function ReviewSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [listing, setListing] = useState<LegacyListing | null>(null);
  const [submission, setSubmission] = useState<PhotoOrderSubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [proposalNote, setProposalNote] = useState("");
  const [changesNote, setChangesNote] = useState("");

  const fetchListing = useCallback(async () => {
    try {
      const [listingRes, submissionRes] = await Promise.all([
        fetch(`/api/listings/${id}`),
        fetch(`/api/listings/${id}/submission`),
      ]);
      if (listingRes.ok) {
        const data = await listingRes.json();
        setListing(data);
      } else if (listingRes.status === 404) {
        router.push("/admin/submissions");
        return;
      }
      if (submissionRes.ok) {
        const subData = await submissionRes.json();
        setSubmission(subData);
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
      if (submission && submission.status === "SUBMITTED") {
        // Approve via submission endpoint
        const res = await fetch(`/api/listings/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: submission.id }),
        });

        if (!res.ok) {
          toast.error("Failed to approve submission");
          return;
        }
      }

      // Also update listing status to APPROVED
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
      const downloadUrl = submission?.id
        ? `/api/listings/${id}/downloads?submissionId=${submission.id}`
        : `/api/listings/${id}/downloads`;
      const res = await fetch(downloadUrl);
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

  async function handlePropose() {
    if (!listing) return;
    setIsProposing(true);
    try {
      // Send the current photo order (non-excluded first, then excluded) as the proposal
      const orderedPhotoIds = [
        ...listing.photoIds.filter((pid) => !listing.photos[pid]?.excluded),
        ...listing.photoIds.filter((pid) => listing.photos[pid]?.excluded),
      ];

      const res = await fetch(`/api/listings/${id}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedPhotoIds,
          note: proposalNote || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose");
      }

      await fetchListing();
      setShowProposeModal(false);
      setProposalNote("");
      toast.success("Proposal sent to the advisor.");
    } catch (error) {
      console.error("Propose error:", error);
      toast.error("Failed to send proposal");
    } finally {
      setIsProposing(false);
    }
  }

  async function handleRequestChanges() {
    if (!submission) return;
    setIsRequestingChanges(true);
    try {
      const res = await fetch(`/api/listings/${id}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          note: changesNote || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to request changes");
      }

      await fetchListing();
      setShowChangesModal(false);
      setChangesNote("");
      toast.success("Changes requested from the advisor.");
    } catch (error) {
      console.error("Request changes error:", error);
      toast.error("Failed to request changes");
    } finally {
      setIsRequestingChanges(false);
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
                  {submission && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      submission.status === "APPROVED" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                      submission.status === "SUBMITTED" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                      submission.status === "CHANGES_REQUESTED" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      {submission.status === "CHANGES_REQUESTED" ? "Changes Requested" : submission.status}
                    </span>
                  )}
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
                <>
                  <button
                    onClick={() => setShowChangesModal(true)}
                    disabled={!submission || submission.status !== "SUBMITTED"}
                    className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">edit_note</span>
                    Request Changes
                  </button>

                  <button
                    onClick={() => setShowProposeModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">send</span>
                    Propose to Advisor
                  </button>

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
                </>
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

        {/* Propose to Advisor Modal */}
        {showProposeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowProposeModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-3xl">
                    send
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-2">
                  Propose Order to Advisor
                </h3>
                <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
                  This will send the current photo order as a proposal to the advisor for approval.
                </p>
                <textarea
                  value={proposalNote}
                  onChange={(e) => setProposalNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowProposeModal(false)}
                  disabled={isProposing}
                  className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePropose}
                  disabled={isProposing}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProposing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Proposal"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Request Changes Modal */}
        {showChangesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowChangesModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-3xl">
                    edit_note
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-2">
                  Request Changes
                </h3>
                <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
                  Ask the advisor to make changes to their photo order.
                </p>
                <textarea
                  value={changesNote}
                  onChange={(e) => setChangesNote(e.target.value)}
                  placeholder="What changes are needed? (optional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowChangesModal(false)}
                  disabled={isRequestingChanges}
                  className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={isRequestingChanges}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRequestingChanges ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Request Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </ListingShell>
  );
}
