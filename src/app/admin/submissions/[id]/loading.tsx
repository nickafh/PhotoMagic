import Sidebar from "@/components/Sidebar";

export default function SubmissionLoading() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div className="p-8 animate-pulse">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="space-y-2">
              <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
