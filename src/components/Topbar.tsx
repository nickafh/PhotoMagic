"use client";

export default function Topbar({ title }: { title?: string }) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sm:px-8 z-10 shrink-0 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <h2
          className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white tracking-tight shrink-0"
          style={{ fontFamily: "'Benton Sans', sans-serif" }}
        >
          PhotoMagic
        </h2>
        {title && (
          <>
            <span className="text-slate-300 dark:text-slate-600 text-lg">/</span>
            <span className="text-base font-medium text-slate-600 dark:text-slate-300 truncate">
              {title}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
