"use client";

export default function Topbar({
  title,
  view,
  setView,
}: {
  title: string;
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
}) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
      <div className="flex flex-col">
        <h2 className="text-lg font-bold dark:text-white leading-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded shadow-sm ${
              view === "grid"
                ? "text-primary dark:text-white bg-white dark:bg-slate-700"
                : "text-slate-400"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded ${
              view === "list"
                ? "text-primary dark:text-white bg-white dark:bg-slate-700"
                : "text-slate-400"
            }`}
          >
            List
          </button>
        </div>

        <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <span className="material-symbols-outlined">info</span>
        </button>
      </div>
    </header>
  );
}