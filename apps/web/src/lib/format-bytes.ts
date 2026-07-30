const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Human-readable byte size for client-only values (e.g. a freshly-selected
 * File's `.size`). Server responses already carry `*_human` strings; use those
 * where available and reserve this for values the API hasn't formatted yet.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[exponent]}`;
}
