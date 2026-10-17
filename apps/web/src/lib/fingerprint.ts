import { Thumbmark } from "@thumbmarkjs/thumbmarkjs";

let cached: Promise<string> | null = null;

/** An anonymous browser fingerprint hash, used only to enforce the one-free-run guest limit.
 * `logging: false` turns off the library's own sampled telemetry. Browser-only. */
export function getFingerprint(): Promise<string> {
  cached ??= new Thumbmark({ logging: false }).get().then((result) => result.thumbmark);
  return cached;
}
