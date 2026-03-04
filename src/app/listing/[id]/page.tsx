"use client";

import { useEffect, useState, useCallback, useRef, useMemo, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { LegacyListing, PhotoOrderSubmissionData } from "@/lib/types";
import PhotoGrid from "@/components/PhotoGrid";
import ExcludedPhotosSection from "@/components/ExcludedPhotosSection";
import ListingShell from "@/components/ListingsShell";
import SubmitModal from "@/components/SubmitModal";
import StatusBadge from "@/components/StatusBadge";
import { hasPermission, canDownloadListing, isListingsTeamOrAdmin } from "@/lib/permissions";
import { toast } from "sonner";

export default function ListingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const id = params.id as string;

  const [listing, setListing] = useState<LegacyListing | null>(null);
  const [submission, setSubmission] = useState<PhotoOrderSubmissionData | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApprovingProposal, setIsApprovingProposal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [proposalNote, setProposalNote] = useState("");
  const [advisorSearch, setAdvisorSearch] = useState("");
  const [advisorResults, setAdvisorResults] = useState<{ id: string; email: string; name: string | null; role: string }[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [showAdvisorDropdown, setShowAdvisorDropdown] = useState(false);
  const [advisorSearchLoading, setAdvisorSearchLoading] = useState(false);
  const advisorSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advisorDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadProgress !== null;

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [authStatus, router]);

  const refresh = useCallback(async () => {
    const [listingRes, submissionRes] = await Promise.all([
      fetch(`/api/listings/${id}`, { cache: "no-store" }),
      fetch(`/api/listings/${id}/submission`, { cache: "no-store" }),
    ]);
    if (!listingRes.ok) {
      if (listingRes.status === 401) {
        router.push("/auth/signin");
        return;
      }
      if (listingRes.status === 403) {
        setAccessDenied(true);
        return;
      }
      throw new Error(`Failed to load listing: ${listingRes.status}`);
    }
    const data = (await listingRes.json()) as LegacyListing;
    setListing(data);

    if (submissionRes.ok) {
      const subData = await submissionRes.json();
      setSubmission(subData);
    }
  }, [id, router]);

  useEffect(() => {
    if (!id || authStatus !== "authenticated") return;
    refresh().catch(console.error);
  }, [id, refresh, authStatus]);

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return;

    const fileArray = Array.from(files);
    const total = fileArray.length;
    setUploadProgress({ current: 0, total });

    let completed = 0;
    let hadError = false;
    const MAX_CONCURRENT = 4;

    async function uploadOne(file: File) {
      const form = new FormData();
      form.append("files", file);

      const res = await fetch(`/api/listings/${id}/photos`, {
        method: "POST",
        body: form,
      });

      completed++;
      setUploadProgress({ current: completed, total });

      if (!res.ok) {
        hadError = true;
        toast.error(`Upload failed for ${file.name} (${res.status})`);
      }
    }

    // Process files in a concurrency-limited pool
    const pending = [...fileArray];
    const executing: Promise<void>[] = [];

    while (pending.length > 0) {
      const file = pending.shift()!;
      const p = uploadOne(file).then(() => {
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= MAX_CONCURRENT) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    setUploadProgress(null);

    if (!hadError) {
      toast.success(`Uploaded ${total} photo${total === 1 ? "" : "s"}`);
      await refresh();
    } else if (completed > 0) {
      await refresh();
    }
  }

  const saveOrder = useCallback(
    async (nextPhotoIds: string[]) => {
      setListing((prev) => (prev ? { ...prev, photoIds: nextPhotoIds } : prev));

      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: nextPhotoIds }),
      });

      if (!res.ok) {
        console.error("Failed to save order", res.status);
        await refresh();
      }
    },
    [id, refresh]
  );

  const togglePhotoExclude = useCallback(
    async (photoId: string) => {
      // Optimistic update
      setListing((prev) => {
        if (!prev) return prev;
        const photo = prev.photos[photoId];
        if (!photo) return prev;
        return {
          ...prev,
          photos: {
            ...prev.photos,
            [photoId]: { ...photo, excluded: !photo.excluded },
          },
        };
      });

      const res = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });

      if (!res.ok) {
        console.error("Failed to toggle exclude", res.status);
        await refresh();
      }
    },
    [id, refresh]
  );

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${id}/submit`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      await refresh();
      toast.success("The listings team has been notified.");
      startTransition(() => {
        setShowSubmitModal(false);
      });
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Listing deleted successfully.");
      router.push("/dashboard");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete listing. Please try again.");
      setIsDeleting(false);
    }
  }

  async function handleApproveProposal() {
    if (!submission) return;
    setIsApprovingProposal(true);
    try {
      const res = await fetch(`/api/listings/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, note: approveNote || undefined }),
      });

      if (!res.ok) throw new Error("Failed to approve proposal");

      await refresh();
      setShowApproveModal(false);
      setApproveNote("");
      toast.success("Approved! This order has been finalized.");
    } catch (error) {
      console.error("Approve proposal error:", error);
      toast.error("Failed to approve proposal.");
    } finally {
      setIsApprovingProposal(false);
    }
  }

  // Debounced advisor search
  useEffect(() => {
    if (advisorSearchTimer.current) {
      clearTimeout(advisorSearchTimer.current);
    }

    if (!advisorSearch.trim()) {
      setAdvisorResults([]);
      setShowAdvisorDropdown(false);
      return;
    }

    advisorSearchTimer.current = setTimeout(async () => {
      setAdvisorSearchLoading(true);
      try {
        const res = await fetch(`/api/users/advisors?search=${encodeURIComponent(advisorSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setAdvisorResults(data);
          setShowAdvisorDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Failed to search advisors:", err);
      } finally {
        setAdvisorSearchLoading(false);
      }
    }, 300);

    return () => {
      if (advisorSearchTimer.current) {
        clearTimeout(advisorSearchTimer.current);
      }
    };
  }, [advisorSearch]);

  // Close advisor dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (advisorDropdownRef.current && !advisorDropdownRef.current.contains(e.target as Node)) {
        setShowAdvisorDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePropose() {
    if (!listing || !selectedAdvisor) return;
    setIsProposing(true);
    try {
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
          advisorId: selectedAdvisor.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose");
      }

      await refresh();
      setShowProposeModal(false);
      setProposalNote("");
      setSelectedAdvisor(null);
      setAdvisorSearch("");
      toast.success("Proposal sent to the advisor.");
    } catch (error) {
      console.error("Propose error:", error);
      toast.error("Failed to send proposal");
    } finally {
      setIsProposing(false);
    }
  }

  // Determine if user can reorder photos based on role and listing status
  // Must be called before early return to maintain hooks order
  const canReorder = useMemo(() => {
    if (!session?.user || !listing) return false;

    // APPROVED: Lock the order for everyone
    if (listing.status === "APPROVED") return false;

    const role = session.user.role;
    const isOwner = session.user.id === listing.userId;

    // DRAFT: Owner can reorder
    if (listing.status === "DRAFT") {
      return isOwner;
    }

    // SUBMITTED: LISTINGS/ADMIN can always reorder
    if (hasPermission(role, "listing:reorder_submitted")) return true;

    // SUBMITTED: Advisor can reorder if they are the approver on the proposal
    if (role === "ADVISOR" && submission?.approverRole === "ADVISOR" && submission?.status === "SUBMITTED") {
      return true;
    }

    return false;
  }, [session, listing, submission]);

  const canDownload = useMemo(() => {
    if (!session?.user || !listing) return false;
    if (listing.status !== "APPROVED") return false;
    return canDownloadListing(session as any, listing.userId);
  }, [session, listing]);

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <span className="material-symbols-outlined text-4xl text-red-400">lock</span>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
            You don&apos;t have permission to view this listing.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (authStatus === "loading" || !listing) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
          <span className="text-slate-500 text-sm">Loading listing...</span>
        </div>
      </div>
    );
  }

  const activePhotoCount = listing.photoIds?.filter(
    (pid) => !listing.photos[pid]?.excluded
  ).length ?? 0;

  const canSubmit = listing.status === "DRAFT" && activePhotoCount > 0;
  const isListingsOrAdmin = isListingsTeamOrAdmin(session as any);

  return (
    <ListingShell
      title={listing.title || listing.address}
      status={listing.status as "DRAFT" | "SUBMITTED" | "APPROVED"}
      actions={
        <div className="flex items-center gap-3">
          <StatusBadge status={listing.status} size="md" />
          <span className="text-xs text-text-grey dark:text-slate-500 mr-2 uppercase font-bold tracking-wider">
            {activePhotoCount} {activePhotoCount === 1 ? "image" : "images"} selected
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            disabled={isUploading || listing.status === "APPROVED"}
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {canDownload && (
            <a
              href={`/api/listings/${id}/downloads`}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download ZIP
            </a>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-10 h-10 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            title="Delete listing"
            aria-label="Delete listing"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
          {listing.status !== "APPROVED" && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  {uploadProgress.current}/{uploadProgress.total}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                  Upload
                </>
              )}
            </button>
          )}
          {listing.status === "DRAFT" ? (
            isListingsOrAdmin ? (
              <button
                onClick={async () => {
                  setSelectedAdvisor(null);
                  setAdvisorSearch("");
                  setAdvisorResults([]);
                  if (listing?.userId) {
                    try {
                      const res = await fetch(`/api/users/${listing.userId}`);
                      if (res.ok) {
                        const owner = await res.json();
                        if (owner.role === "ADVISOR") {
                          setSelectedAdvisor({ id: owner.id, email: owner.email, name: owner.name });
                        }
                      }
                    } catch {}
                  }
                  setShowProposeModal(true);
                }}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm uppercase tracking-wider disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Propose to Advisor
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={!canSubmit}
                className="btn-gold flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Submit for Review
              </button>
            )
          ) : listing.status === "SUBMITTED" && isListingsOrAdmin ? (
            <>
              {submission?.initiatorRole !== "ADVISOR" && (
                <button
                  onClick={async () => {
                    setSelectedAdvisor(null);
                    setAdvisorSearch("");
                    setAdvisorResults([]);
                    if (listing?.userId) {
                      try {
                        const res = await fetch(`/api/users/${listing.userId}`);
                        if (res.ok) {
                          const owner = await res.json();
                          if (owner.role === "ADVISOR") {
                            setSelectedAdvisor({ id: owner.id, email: owner.email, name: owner.name });
                          }
                        }
                      } catch {}
                    }
                    setShowProposeModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm uppercase tracking-wider"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Propose to Advisor
                </button>
              )}
              <button
                onClick={() => setShowApproveModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Approve
              </button>
            </>
          ) : (
            <button
              disabled
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold rounded-lg text-sm uppercase tracking-wider cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {listing.status === "SUBMITTED" ? "Pending Review" : "Approved"}
            </button>
          )}
        </div>
      }
      mobileActions={
        <div className="flex gap-2">
          {canDownload && (
            <a
              href={`/api/listings/${id}/downloads`}
              className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all shrink-0"
              title="Download ZIP"
              aria-label="Download ZIP"
            >
              <span className="material-symbols-outlined text-xl">download</span>
            </a>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0"
            title="Delete listing"
            aria-label="Delete listing"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
          {listing.status !== "APPROVED" && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1C2836] hover:bg-[#253444] text-white py-2.5 px-4 rounded-lg font-bold text-xs tracking-widest transition-colors uppercase disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">
                    progress_activity
                  </span>
                  {uploadProgress.current}/{uploadProgress.total}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">add_a_photo</span>
                  Upload
                </>
              )}
            </button>
          )}
          {listing.status === "DRAFT" ? (
            isListingsOrAdmin ? (
              <button
                onClick={async () => {
                  setSelectedAdvisor(null);
                  setAdvisorSearch("");
                  setAdvisorResults([]);
                  if (listing?.userId) {
                    try {
                      const res = await fetch(`/api/users/${listing.userId}`);
                      if (res.ok) {
                        const owner = await res.json();
                        if (owner.role === "ADVISOR") {
                          setSelectedAdvisor({ id: owner.id, email: owner.email, name: owner.name });
                        }
                      }
                    } catch {}
                  }
                  setShowProposeModal(true);
                }}
                disabled={!canSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-lg font-medium text-xs tracking-widest uppercase disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">send</span>
                Propose
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={!canSubmit}
                className="flex-1 btn-gold flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs tracking-widest uppercase"
              >
                <span className="material-symbols-outlined text-lg">send</span>
                Submit
              </button>
            )
          ) : listing.status === "SUBMITTED" && isListingsOrAdmin ? (
            <>
              {submission?.initiatorRole !== "ADVISOR" && (
                <button
                  onClick={async () => {
                    setSelectedAdvisor(null);
                    setAdvisorSearch("");
                    setAdvisorResults([]);
                    if (listing?.userId) {
                      try {
                        const res = await fetch(`/api/users/${listing.userId}`);
                        if (res.ok) {
                          const owner = await res.json();
                          if (owner.role === "ADVISOR") {
                            setSelectedAdvisor({ id: owner.id, email: owner.email, name: owner.name });
                          }
                        }
                      } catch {}
                    }
                    setShowProposeModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-lg font-medium text-xs tracking-widest uppercase"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                  Propose
                </button>
              )}
              <button
                onClick={() => setShowApproveModal(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg font-medium text-xs tracking-widest uppercase"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Approve
              </button>
            </>
          ) : (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 py-2.5 px-4 rounded-lg font-semibold text-xs tracking-widest uppercase cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {listing.status === "SUBMITTED" ? "Pending" : "Approved"}
            </button>
          )}
        </div>
      }
    >
      {isUploading && uploadProgress && (
        <div className="mb-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-3 animate-fade-in">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
            <span>Uploading photos...</span>
            <span className="font-semibold">
              {uploadProgress.current} of {uploadProgress.total}
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 dark:bg-amber-600 transition-all duration-300 ease-out"
              style={{
                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Proposal notification banner */}
      {submission &&
        submission.status === "SUBMITTED" &&
        submission.approverRole === "ADVISOR" &&
        session?.user?.role === "ADVISOR" && (
        <div className="mb-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 mt-0.5">
                rate_review
              </span>
              <div>
                <p className="font-semibold text-purple-900 dark:text-purple-200">
                  The Listings Team has proposed a new photo order
                </p>
                {submission.note && (
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Note: {submission.note}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Approve Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      <PhotoGrid
        listingId={listing.id}
        photoIds={listing.photoIds ?? []}
        photos={listing.photos ?? {}}
        onReorder={canReorder ? saveOrder : undefined}
        onToggleExclude={canReorder ? togglePhotoExclude : undefined}
      />

      <ExcludedPhotosSection
        listingId={listing.id}
        photoIds={listing.photoIds ?? []}
        photos={listing.photos ?? {}}
        onRestore={listing.status !== "APPROVED" ? togglePhotoExclude : undefined}
      />

      {showSubmitModal && (
        <SubmitModal
          address={listing.address}
          photoCount={activePhotoCount}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          address={listing.address}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
      )}

      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowProposeModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-3xl">
                  send
                </span>
              </div>
              <h3 className="text-xl font-display font-semibold text-center text-slate-900 dark:text-white mb-2">
                Propose Order to Advisor
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-4">
                This will send the current photo order as a proposal to the advisor for approval.
              </p>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select Advisor
              </label>
              {selectedAdvisor ? (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {selectedAdvisor.name || selectedAdvisor.email}
                    </span>
                    {selectedAdvisor.name && (
                      <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                        {selectedAdvisor.email}
                      </span>
                    )}
                    {selectedAdvisor.id === listing?.userId && (
                      <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(listing owner)</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAdvisor(null);
                      setAdvisorSearch("");
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ) : (
                <div className="relative mb-3" ref={advisorDropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={advisorSearch}
                      onChange={(e) => setAdvisorSearch(e.target.value)}
                      onFocus={() => {
                        if (advisorResults.length > 0) setShowAdvisorDropdown(true);
                      }}
                      placeholder="Search by name or email..."
                      inputMode="search"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {advisorSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {showAdvisorDropdown && advisorResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {advisorResults.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setSelectedAdvisor({ id: a.id, email: a.email, name: a.name });
                            setAdvisorSearch("");
                            setAdvisorResults([]);
                            setShowAdvisorDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="font-medium text-slate-900 dark:text-white text-sm">
                            {a.name || a.email}
                            {a.id === listing?.userId && (
                              <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(listing owner)</span>
                            )}
                          </div>
                          {a.name && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{a.email}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <textarea
                value={proposalNote}
                onChange={(e) => setProposalNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowProposeModal(false)}
                disabled={isProposing}
                className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePropose}
                disabled={isProposing || !selectedAdvisor}
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
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowApproveModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-3xl">
                  check_circle
                </span>
              </div>
              <h3 className="text-xl font-display font-semibold text-center text-slate-900 dark:text-white mb-2">
                Approve Photo Order
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-4">
                {isListingsOrAdmin
                  ? "Once approved, this order is finalized and will be used for this listing."
                  : "Once you approve, this is finalized and this order will be used for your listing."}
              </p>
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={isApprovingProposal}
                className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveProposal}
                disabled={isApprovingProposal}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isApprovingProposal ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ListingShell>
  );
}

function DeleteConfirmModal({
  address,
  onClose,
  onConfirm,
  isDeleting,
}: {
  address: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="p-6">
          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">
              delete_forever
            </span>
          </div>

          {/* Content */}
          <h3 className="text-xl font-display font-semibold text-center text-slate-900 dark:text-white mb-2">
            Delete Listing?
          </h3>
          <p className="text-center text-slate-600 dark:text-slate-300 mb-1">
            Are you sure you want to delete
          </p>
          <p className="text-center font-semibold text-slate-900 dark:text-white mb-4">
            {address}
          </p>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            This action cannot be undone. All photos will be permanently removed.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">delete</span>
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
