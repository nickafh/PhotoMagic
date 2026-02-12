"use client";

export default function Topbar({ title }: { title: string }) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 sm:px-8 z-10 shrink-0 shadow-sm">
      <h2 className="text-lg sm:text-xl font-display font-semibold text-slate-800 dark:text-white tracking-tight truncate">
        {title}
      </h2>
    </header>
  );
}
