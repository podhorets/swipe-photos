import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

/**
 * Checkpoint written after EVERY compare batch. On a large library the
 * feature-print compare pass runs for many minutes, so a killed/backgrounded
 * app must resume where it stopped — with everything found so far instantly
 * available — instead of starting over.
 *
 * Signature rules:
 * - `newestCreationTime` must match exactly (new photos invalidate — they can
 *   form new groups anywhere in the timeline).
 * - `photoCount` may only SHRINK (deletions are safe: groups referencing
 *   deleted photos are dropped at read time by filterGroupsForReview).
 */
interface ScanCheckpoint {
  version: 2;
  photoCount: number;
  newestCreationTime: number;
  /** Groups found by the compare pass so far. */
  groups: string[][];
  /** Candidate photos fully processed — the resume offset. */
  processedCandidatePhotos: number;
  /** True once the compare pass finished (analysis may still be pending). */
  compareComplete: boolean;
}

export interface ScanResume {
  groups: string[][];
  processedCandidatePhotos: number;
  compareComplete: boolean;
}

export function loadScanCheckpoint(
  photoCount: number,
  newestCreationTime: number,
): ScanResume | null {
  const raw = storage.getString(STORAGE_KEYS.similarScanCheckpoint);
  if (!raw) return null;
  try {
    const cp = JSON.parse(raw) as ScanCheckpoint;
    if (
      cp.version === 2 &&
      cp.newestCreationTime === newestCreationTime &&
      photoCount <= cp.photoCount
    ) {
      return {
        groups: cp.groups,
        processedCandidatePhotos: cp.processedCandidatePhotos,
        compareComplete: cp.compareComplete,
      };
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
  processedCandidatePhotos: number,
  compareComplete: boolean,
): void {
  const cp: ScanCheckpoint = {
    version: 2,
    photoCount,
    newestCreationTime,
    groups,
    processedCandidatePhotos,
    compareComplete,
  };
  storage.set(STORAGE_KEYS.similarScanCheckpoint, JSON.stringify(cp));
}

export function clearScanCheckpoint(): void {
  storage.remove(STORAGE_KEYS.similarScanCheckpoint);
}
