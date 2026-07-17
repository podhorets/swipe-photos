import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

/**
 * Checkpoint written after the (expensive) feature-print compare phase.
 * If the app dies during the minutes-long blur/face analysis phase, the next
 * scan reuses these groups instead of re-comparing the whole library.
 * The signature ties the checkpoint to the exact library state it was
 * computed from — any change (new/deleted photos) invalidates it.
 */
interface ScanCheckpoint {
  photoCount: number;
  newestCreationTime: number;
  groups: string[][];
}

export function loadScanCheckpoint(
  photoCount: number,
  newestCreationTime: number,
): string[][] | null {
  const raw = storage.getString(STORAGE_KEYS.similarScanCheckpoint);
  if (!raw) return null;
  try {
    const cp = JSON.parse(raw) as ScanCheckpoint;
    if (cp.photoCount === photoCount && cp.newestCreationTime === newestCreationTime) {
      return cp.groups;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveScanCheckpoint(
  photoCount: number,
  newestCreationTime: number,
  groups: string[][],
): void {
  const cp: ScanCheckpoint = { photoCount, newestCreationTime, groups };
  storage.set(STORAGE_KEYS.similarScanCheckpoint, JSON.stringify(cp));
}

export function clearScanCheckpoint(): void {
  storage.remove(STORAGE_KEYS.similarScanCheckpoint);
}
