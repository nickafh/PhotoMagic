"use client";

import { useRef } from "react";

export function UploadDropzone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="rounded-xl border border-dashed border-slate-300 p-4 bg-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Upload photos</div>
          <div className="text-sm text-slate-500">Drag & drop or choose files (.jpg, .png)</div>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onFiles(e.target.files);
            }}
          />
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </button>
        </div>
      </div>
    </div>
  );
}