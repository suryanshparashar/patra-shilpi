/** The provider's error code and status, e.g. "429 RESOURCE_EXHAUSTED". Renders nothing without one. */
export function ErrorCode({ code }: { code?: string | null }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-800 ring-1 ring-red-200">
      <span className="text-red-600">Error code</span>
      <code className="font-mono font-semibold">{code}</code>
    </span>
  );
}
