/** Zero-padded MM-DD string from a Date, used for "On This Day" matching. */
export function toMMDD(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

/** YYYY-MM string used as month group key. */
export function toYYYYMM(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/** Human-readable month label, e.g. "January 2024". */
export function monthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "3 years ago", "1 year ago", "This year". */
export function yearsAgoLabel(year: number): string {
  const diff = new Date().getFullYear() - year;
  if (diff === 0) return 'This year';
  if (diff === 1) return '1 year ago';
  return `${diff} years ago`;
}

/** Format bytes as "4.2 MB", "1.1 GB", etc. */
/** @param decimals overrides the per-unit default precision (e.g. 0 → "313 GB") */
export function formatBytes(bytes: number, decimals?: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(decimals ?? 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(decimals ?? 2)} GB`;
}

/** Format duration in seconds as "1:23" or "12:34". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
