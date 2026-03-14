"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import ListingShell from "@/components/ListingsShell";
import StatusBadge from "@/components/StatusBadge";
import PhotoGrid from "@/components/PhotoGrid";
import ExcludedPhotosSection from "@/components/ExcludedPhotosSection";
import type { LegacyListing, PhotoOrderSubmissionData } from "@/lib/types";

export default function ReviewSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [listing, setListing] = useState<LegacyListing | null>(null);
  const [submission, setSubmission] = useState<PhotoOrderSubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [proposalNote, setProposalNote] = useState("");
  const [changesNote, setChangesNote] = useState("");
  const [advisorSearch, setAdvisorSearch] = useState("");
  const [advisorResults, setAdvisorResults] = useState<{ id: string; email: string; name: string | null; role: string }[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [showAdvisorDropdown, setShowAdvisorDropdown] = useState(false);
  const [advisorSearchLoading, setAdvisorSearchLoading] = useState(false);
  const advisorSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advisorDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const isUploading = uploadProgress !== null;

  const fetchListing = useCallback(async () => {
    try {
      const [listingRes, submissionRes] = await Promise.all([
        fetch(`/api/listings/${id}`, { cache: "no-store" }),
        fetch(`/api/listings/${id}/submission`, { cache: "no-store" }),
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
      await fetchListing();
    } else if (completed > 0) {
      await fetchListing();
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
        await fetchListing();
      }
    },
    [id, fetchListing]
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
        await fetchListing();
      }
    },
    [id, fetchListing]
  );

  async function handleApprove() {
    setIsApproving(true);
    try {
      if (submission && submission.status === "SUBMITTED") {
        const res = await fetch(`/api/listings/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: submission.id, note: approveNote || undefined }),
        });

        if (!res.ok) {
          toast.error("Failed to approve submission");
          return;
        }

        await fetchListing();
        setShowApproveModal(false);
        setApproveNote("");
        toast.success("Listing approved.");
      }
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Failed to approve listing");
    } finally {
      setIsApproving(false);
    }
  }

  async function handlePropose() {
    if (!listing || !selectedAdvisor) return;
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
          advisorId: selectedAdvisor.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to propose");
      }

      await fetchListing();
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

  async function handleRequestChanges() {
    setIsRequestingChanges(true);
    try {
      const res = await fetch(`/api/listings/${id}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission?.id,
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
      router.push("/admin/submissions");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete listing. Please try again.");
      setIsDeleting(false);
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

  const activePhotoCount = listing.photoIds?.filter(
    (pid) => !listing.photos[pid]?.excluded
  ).length ?? 0;

  const pendingAdvisorApproval = submission?.status === "SUBMITTED" && submission?.approverRole === "ADVISOR";
  const canEdit = listing.status !== "APPROVED";

  return (
    <ListingShell
      title={listing.address}
      status={listing.status as "DRAFT" | "SUBMITTED" | "APPROVED"}
      actions={
        <div className="flex items-center gap-3">
          <StatusBadge status={listing.status} size="md" />
          {submission && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              submission.status === "APPROVED" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
              submission.status === "SUBMITTED" && submission.approverRole === "ADVISOR" ? "bg-gold/10 text-gold border border-gold/30" :
              submission.status === "SUBMITTED" ? "bg-primary/5 text-primary border border-primary/20" :
              submission.status === "CHANGES_REQUESTED" ? "bg-gold/10 text-gold border border-gold/30" :
              "bg-gray-100 text-text-grey"
            }`}>
              {submission.status === "SUBMITTED" && submission.approverRole === "ADVISOR" ? (
                <><span className="material-symbols-outlined text-xs">hourglass_top</span>Pending Advisor</>
              ) : submission.status === "CHANGES_REQUESTED" ? "Changes Requested" : submission.status === "SUBMITTED" ? "Needs Review" : submission.status}
            </span>
          )}
          <span className="text-xs text-text-grey dark:text-slate-500 mr-2 uppercase font-bold tracking-wider">
            {activePhotoCount} {activePhotoCount === 1 ? "image" : "images"} selected
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            disabled={isUploading || !canEdit}
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-10 h-10 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            title="Delete listing"
            aria-label="Delete listing"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
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
          {listing.status === "APPROVED" ? (
            <a
              href={submission?.id
                ? `/api/listings/${id}/downloads?submissionId=${submission.id}`
                : `/api/listings/${id}/downloads`}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-bold text-sm uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download ZIP
            </a>
          ) : listing.status === "SUBMITTED" && !pendingAdvisorApproval ? (
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-bold text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Propose to Advisor
                </button>
              )}
              <button
                onClick={() => setShowApproveModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all font-bold text-sm uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Approve
              </button>
            </>
          ) : null}
        </div>
      }
      mobileActions={
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0"
            title="Delete listing"
            aria-label="Delete listing"
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2.5 px-4 rounded-lg font-bold text-xs tracking-widest transition-colors uppercase disabled:opacity-60 disabled:cursor-not-allowed"
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
          {listing.status === "APPROVED" ? (
            <a
              href={submission?.id
                ? `/api/listings/${id}/downloads?submissionId=${submission.id}`
                : `/api/listings/${id}/downloads`}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2.5 px-4 rounded-lg font-bold text-xs tracking-widest uppercase"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Download
            </a>
          ) : listing.status === "SUBMITTED" && !pendingAdvisorApproval ? (
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
                  className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2.5 px-4 rounded-lg font-bold text-xs tracking-widest uppercase"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                  Propose
                </button>
              )}
              <button
                onClick={() => setShowApproveModal(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg font-bold text-xs tracking-widest uppercase"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Approve
              </button>
            </>
          ) : null}
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
              className="h-full bg-gold transition-all duration-300 ease-out"
              style={{
                width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <PhotoGrid
        listingId={listing.id}
        photoIds={listing.photoIds ?? []}
        photos={listing.photos ?? {}}
        onReorder={canEdit ? saveOrder : undefined}
        onToggleExclude={canEdit ? togglePhotoExclude : undefined}
      />

      <ExcludedPhotosSection
        listingId={listing.id}
        photoIds={listing.photoIds ?? []}
        photos={listing.photos ?? {}}
        onRestore={canEdit ? togglePhotoExclude : undefined}
      />

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">
                  delete_forever
                </span>
              </div>
              <h3 className="text-xl font-semibold text-center text-slate-900 dark:text-white mb-2">
                Delete Listing?
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-1">
                Are you sure you want to delete
              </p>
              <p className="text-center font-semibold text-slate-900 dark:text-white mb-4">
                {listing.address}
              </p>
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                This action cannot be undone. All photos will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
      )}

      {/* Propose to Advisor Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowProposeModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-gold text-3xl">
                  send
                </span>
              </div>
              <h3 className="text-xl font-semibold text-center text-slate-900 dark:text-white mb-2">
                Propose Order to Advisor
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-4">
                This will send the current photo order as a proposal to the advisor for approval.
              </p>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select Advisor
              </label>
              {selectedAdvisor ? (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
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
                      <span className="ml-2 text-xs text-gold">(listing owner)</span>
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
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    {advisorSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                          className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="font-medium text-slate-900 dark:text-white text-sm">
                            {a.name || a.email}
                            {a.id === listing?.userId && (
                              <span className="ml-2 text-xs text-gold">(listing owner)</span>
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
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
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
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowChangesModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-3xl">
                  edit_note
                </span>
              </div>
              <h3 className="text-xl font-semibold text-center text-slate-900 dark:text-white mb-2">
                Request Changes
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-4">
                Ask the advisor to make changes to their photo order.
              </p>
              <textarea
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                placeholder="What changes are needed? (optional)"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowChangesModal(false)}
                disabled={isRequestingChanges}
                className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
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

      {/* Approve Modal */}
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
              <h3 className="text-xl font-semibold text-center text-slate-900 dark:text-white mb-2">
                Approve Photo Order
              </h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-4">
                Once approved, this order is finalized and will be used for this listing.
              </p>
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Add a note for the advisor (optional)"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={isApproving}
                className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isApproving ? (
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
