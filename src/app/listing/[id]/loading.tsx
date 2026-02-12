export default function ListingLoading() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="animate-pulse w-full max-w-4xl">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-6" />
          <div className="flex gap-3 mb-8">
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-slate-200 dark:bg-slate-700"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
