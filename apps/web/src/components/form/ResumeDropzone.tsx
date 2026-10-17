"use client";

import { useRef, useState } from "react";

import { FileIcon, UploadIcon, XIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";

export function ResumeDropzone({
  file,
  onChange,
  error,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    const picked = files?.[0];
    if (picked) onChange(picked);
  }

  return (
    <div>
      <span id="resume-label" className="block text-sm font-medium text-stone-900">
        Resume
      </span>
      <p className="mt-0.5 text-sm text-stone-500">A text-based PDF, up to 5 MB (not a scan).</p>

      {file ? (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-3 shadow-sm">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
            <FileIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-900">{file.name}</p>
            <p className="text-xs text-stone-500">{formatBytes(file.size)}</p>
          </div>
          <button
            id="resume-remove"
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-label={`Remove ${file.name}`}
          >
            <XIcon />
          </button>
        </div>
      ) : (
        <button
          id="resume-dropzone"
          type="button"
          aria-labelledby="resume-label"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={`mt-2 flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
            dragging
              ? "border-emerald-500 bg-emerald-50"
              : error
                ? "border-red-300 bg-white"
                : "border-stone-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40"
          }`}
        >
          <UploadIcon className="size-6 text-emerald-600" />
          <span className="text-sm font-medium text-stone-900">Drop your PDF here or browse</span>
          <span className="text-xs text-stone-500">PDF only</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
        tabIndex={-1}
      />
      <p role="alert" className="mt-1 min-h-4 text-xs text-red-600">
        {error}
      </p>
    </div>
  );
}
