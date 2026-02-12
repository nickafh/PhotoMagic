"use client";

interface SubmitModalProps {
  address: string;
  photoCount: number;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function SubmitModal({
  address,
  photoCount,
  onClose,
  onSubmit,
  isSubmitting,
}: SubmitModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-amber-600">
                send
              </span>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
            Submit for Review
          </h2>

          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            Ready to submit your photo arrangement for{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {address}
            </span>
            ?
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Photos to include
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {photoCount}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            The listings team will be notified and can review your photo arrangement.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">send</span>
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
