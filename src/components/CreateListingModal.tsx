"use client";

import { useState } from "react";

interface CreateListingModalProps {
  onClose: () => void;
  onCreate: (address: string) => Promise<void>;
}

export default function CreateListingModal({
  onClose,
  onCreate,
}: CreateListingModalProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = address.trim();
    if (!trimmed) {
      setError("Address is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onCreate(trimmed);
    } catch (err) {
      setError("Failed to create listing. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-display font-semibold text-gray-900 dark:text-white tracking-tight">
            Create New Listing
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <label htmlFor="create-listing-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Property Address
          </label>
          <input
            id="create-listing-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1234 Main Street, Atlanta GA"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-0 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 transition-colors"
            autoFocus
            disabled={loading}
          />

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Enter the full property address. This will be used to name the photo
            files when downloading.
          </p>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 active:bg-amber-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">add</span>
                  Create Listing
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
