"use client";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function ListingShell({
  title,
  view,
  setView,
  actions,
  children,
}: {
  title: string;
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={title} view={view} setView={setView} />

        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-3 flex items-center justify-end z-10 shrink-0">
          {actions}
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">{children}</div>
      </main>
    </div>
  );
}