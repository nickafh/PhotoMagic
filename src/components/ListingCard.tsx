"use client";

import Link from "next/link";
import type { LegacyListing } from "@/lib/types";
import StatusBadge from "./StatusBadge";

interface ListingCardProps {
  listing: LegacyListing;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const photoCount = listing.photoIds.length;
  const firstPhotoId = listing.photoIds[0];
  const thumbnailUrl = firstPhotoId
    ? `/api/photos/${firstPhotoId}?listingId=${listing.id}&thumb=1`
    : null;

  const formattedDate = new Date(listing.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden hover:shadow-lg hover:ring-amber-200 dark:hover:ring-amber-800/50 hover:border-amber-300 dark:hover:border-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-all duration-200"
    >
      <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={listing.address}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">
              photo_library
            </span>
          </div>
        )}

        <div className="absolute top-2 right-2">
          <StatusBadge status={listing.status} />
        </div>

        {photoCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">photo</span>
            {photoCount}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          {listing.address}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Updated {formattedDate}
        </p>
      </div>
    </Link>
  );
}
