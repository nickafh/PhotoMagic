"use client";

export function PhotoList({ items }: { items: { id: string; src: string; index: number }[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="h-8 w-8 rounded-full bg-amber-600 text-white text-xs font-bold grid place-items-center">
            {it.index}
          </div>
          <img src={it.src} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
          <div className="text-sm text-slate-600">Photo {it.index}</div>
        </div>
      ))}
    </div>
  );
}