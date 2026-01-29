"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import type { Listing } from "@/lib/types";
import PhotoGrid from "@/components/PhotoGrid";
import ListingShell from "@/components/ListingsShell";

export default function ListingPage() {
  const params = useParams();
  const id = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/listings/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load listing: ${res.status}`);
    const data = (await res.json()) as Listing;
    setListing(data);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    refresh().catch(console.error);
  }, [id, refresh]);

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return;

    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));

    const res = await fetch(`/api/listings/${id}/photos`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      alert(`Upload failed (${res.status})`);
      return;
    }

    await refresh();
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

  if (!listing) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark grid place-items-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  const photoCount = listing.photoIds?.length ?? 0;

  return (
    <ListingShell
      title={listing.title || listing.address}
      view={view}
      setView={setView}
      actions={
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-grey dark:text-slate-500 mr-2 uppercase font-bold tracking-wider">
            {photoCount} {photoCount === 1 ? "image" : "images"} selected
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            Upload
          </button>
          <button
            className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-[#B18A35] text-white font-bold rounded-lg shadow-lg shadow-gold/20 transition-all text-sm uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save Arrangement
          </button>
        </div>
      }
    >
      <PhotoGrid
        listingId={listing.id}
        photoIds={listing.photoIds ?? []}
        onReorder={saveOrder}
      />
    </ListingShell>
  );
}