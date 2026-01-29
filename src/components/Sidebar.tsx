"use client";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-primary text-white flex flex-col shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-gold rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">
              auto_awesome_motion
            </span>
          </div>
          <h1 className="font-bold text-xl tracking-tight">PhotoMagic</h1>
        </div>

        <nav className="space-y-1">
          <a className="flex items-center gap-3 px-3 py-2.5 bg-white/10 rounded-lg transition-colors" href="/">
            <span className="material-symbols-outlined">grid_view</span>
            <span className="font-medium">All Listings</span>
          </a>

          <div className="pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 px-3">
            Project Settings
          </div>

          <button
            type="button"
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-slate-300 hover:text-white"
            onClick={() => alert("Preferences coming soon")}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="font-medium">Preferences</span>
          </button>
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gold/50 bg-white/10 grid place-items-center">
            <span className="text-xs font-bold">N</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">Nick</p>
            <p className="text-xs text-slate-400 truncate">Editor</p>
          </div>
        </div>
      </div>
    </aside>
  );
}