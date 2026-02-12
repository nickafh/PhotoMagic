"use client";

import { useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen">
      <Sidebar listings={[]} />
      <main className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">
              error
            </span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            We couldn&apos;t load your dashboard. Please try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Refresh
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
