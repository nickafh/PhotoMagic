"use client";

import { useEffect, useState, startTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ListingShell from "@/components/ListingsShell";
import ListingCard from "@/components/ListingCard";
import CreateListingModal from "@/components/CreateListingModal";
import type { LegacyListing } from "@/lib/types";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [listings, setListings] = useState<LegacyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchListings();
    }
  }, [status, router]);

  async function fetchListings() {
    try {
      const res = await fetch("/api/listings");
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error("Failed to fetch listings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateListing(address: string) {
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!res.ok) {
      throw new Error("Failed to create listing");
    }

    const listing = await res.json();
    startTransition(() => {
      router.push(`/listing/${listing.id}`);
    });
  }

  if (status === "loading" || loading) {
    return (
      <ListingShell title="My Listings">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </ListingShell>
    );
  }

  return (
    <ListingShell
      title="My Listings"
      actions={
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-900 active:bg-amber-800 transition-colors font-medium shadow-sm"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Create Listing
        </button>
      }
    >
      <div className="p-3 md:p-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white tracking-tight">
              My Listings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {listings.length === 0
                ? "Create your first listing to get started"
                : `${listings.length} listing${listings.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-black/5 dark:ring-white/10 border border-gray-200 dark:border-gray-700 text-center py-16 px-8 max-w-lg mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 mb-5 ring-1 ring-amber-200/50 dark:ring-amber-800/30">
              <span className="material-symbols-outlined text-3xl text-amber-600 dark:text-amber-400">
                photo_library
              </span>
            </div>
            <h3 className="text-xl font-display font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">
              No listings yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">
              Create a new listing to start uploading and arranging photos for
              your properties.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-6 px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:bg-amber-800 transition-colors font-medium shadow-sm"
            >
              Create Your First Listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateListing}
        />
      )}
    </ListingShell>
  );
}
