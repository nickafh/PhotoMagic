"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [address, setAddress] = useState("");
  const router = useRouter();

  async function createListing() {
    const addr = address.trim();
    if (!addr) return;

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr, title: "Spring 2024 Collection" }),
    });

    if (!res.ok) {
      alert(`Failed to create listing (${res.status})`);
      return;
    }

    const listing = await res.json();
    router.push(`/listing/${listing.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-2xl font-semibold">PhotoMagic</div>
        <div className="text-slate-500 mt-1">
          Create a new listing, upload photos, arrange, download ZIP.
        </div>

        <label className="block mt-6 text-sm font-medium">Property Address</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createListing();
          }}
          placeholder="1234 Main Street, Atlanta GA"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
        />

        <button
          onClick={createListing}
          disabled={!address.trim()}
          className="mt-4 w-full rounded-lg bg-amber-600 text-white font-semibold py-2 hover:bg-amber-700 disabled:opacity-50"
        >
          Create Listing
        </button>
      </div>
    </div>
  );
}