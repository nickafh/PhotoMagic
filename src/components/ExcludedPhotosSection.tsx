"use client";

import type { PhotoMeta } from "@/lib/types";

interface ExcludedPhotosSectionProps {
  listingId: string;
  photoIds: string[];
  photos: Record<string, PhotoMeta>;
  onRestore: (photoId: string) => void;
}

export default function ExcludedPhotosSection({
  listingId,
  photoIds,
  photos,
  onRestore,
}: ExcludedPhotosSectionProps) {
  const excludedPhotos = photoIds.filter((id) => photos[id]?.excluded);

  if (excludedPhotos.length === 0) {
    return null;
  }

  return (
    <div className="mt-10 pt-8 border-t border-slate-200/60 dark:border-slate-700/50 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-lg">
            hide_image
          </span>
        </div>
        <h3 className="text-base font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
          Do Not Use
          <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
            ({excludedPhotos.length})
          </span>
        </h3>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-5 ml-11">
        These photos will be placed in a "do_not_use" folder in the download.
      </p>

      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 md:gap-3">
        {excludedPhotos.map((id, idx) => (
          <ExcludedTile
            key={id}
            id={id}
            listingId={listingId}
            onRestore={() => onRestore(id)}
            delay={idx * 30}
          />
        ))}
      </div>
    </div>
  );
}

interface ExcludedTileProps {
  id: string;
  listingId: string;
  onRestore: () => void;
  delay?: number;
}

function ExcludedTile({ id, listingId, onRestore, delay = 0 }: ExcludedTileProps) {
  return (
    <div
      className="relative group animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="aspect-square rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 opacity-50 transition-opacity duration-300 group-hover:opacity-70">
        <img
          src={`/api/photos/${id}?listingId=${listingId}&thumb=1`}
          alt=""
          className="w-full h-full object-cover grayscale"
          draggable={false}
        />
      </div>

      {/* Restore button - shown on hover */}
      <button
        onClick={onRestore}
        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg"
        title="Restore photo"
      >
        <div className="w-9 h-9 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center border-2 border-white/90 shadow-lg transition-all duration-200 scale-90 group-hover:scale-100">
          <span className="material-symbols-outlined text-white text-lg">add</span>
        </div>
      </button>
    </div>
  );
}
