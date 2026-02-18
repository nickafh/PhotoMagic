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
import { hasPermission } from "@/lib/permissions";
import { toast } from "sonner";

export default function ListingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const id = params.id as string;

  const [listing, setListing] = useState<LegacyListing | null>(null);
  const [submission, setSubmission] = useState<PhotoOrderSubmissionData | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApprovingProposal, setIsApprovingProposal] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  );
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
        body: JSON.stringify({ submissionId: submission.id }),
      });

      if (!res.ok) throw new Error("Failed to approve proposal");

      await refresh();
      toast.success("Proposal approved.");
    } catch (error) {
      console.error("Approve proposal error:", error);
      toast.error("Failed to approve proposal.");
    } finally {
      setIsApprovingProposal(false);
    }
  }

  async function handleRequestChanges() {
    if (!submission) return;
    setIsRequestingChanges(true);
    try {
      const res = await fetch(`/api/listings/${id}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id }),
      });

      if (!res.ok) throw new Error("Failed to request changes");

      await refresh();
      toast.success("Changes requested.");
    } catch (error) {
      console.error("Request changes error:", error);
      toast.error("Failed to request changes.");
    } finally {
      setIsRequestingChanges(false);
    }
  }

  // Determine if user can reorder photos based on role and listing status
  // Must be called before early return to maintain hooks order
  const canReorder = useMemo(() => {
    if (!session?.user || !listing) return false;
    const role = session.user.role;
    const isOwner = session.user.id === listing.userId;

    // DRAFT: Owner can reorder
    if (listing.status === "DRAFT") {
      return isOwner;
    }

    // SUBMITTED/APPROVED: Only LISTINGS or ADMIN can reorder
    return hasPermission(role, "listing:reorder_submitted");
  }, [session, listing]);

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
            disabled={isUploading}
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-10 h-10 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            title="Delete listing"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
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
          {listing.status === "DRAFT" ? (
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={!canSubmit}
              className="btn-gold flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Submit for Review
            </button>
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
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0"
            title="Delete listing"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
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
          {listing.status === "DRAFT" ? (
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={!canSubmit}
              className="flex-1 btn-gold flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs tracking-widest uppercase"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              Submit
            </button>
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
                onClick={handleRequestChanges}
                disabled={isRequestingChanges}
                className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
              >
                {isRequestingChanges ? "Requesting..." : "Request Changes"}
              </button>
              <button
                onClick={handleApproveProposal}
                disabled={isApprovingProposal}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isApprovingProposal ? "Approving..." : "Approve Proposal"}
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
        onToggleExclude={listing.status === "DRAFT" ? togglePhotoExclude : undefined}
      />

      <ExcludedPhotosSection
        listingId={listing.id}
        photoIds={listing.photoIds ?? []}
        photos={listing.photos ?? {}}
        onRestore={togglePhotoExclude}
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
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
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
