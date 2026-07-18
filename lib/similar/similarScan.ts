import * as Device from 'expo-device';
import { isPhotoAnalyzerAvailable, PhotoAnalyzer } from 'expo-photo-analyzer';
import { SIMILAR } from '@/constants/config';
import { groupAssetsByTime } from '@/lib/similar/timeGroups';
import { backfillAnalysis, pickBestShots } from '@/lib/similar/bestShot';
import {
  clearScanCheckpoint,
  loadScanCheckpoint,
  saveScanCheckpoint,
} from '@/lib/similar/scanCheckpoint';
import type { AssetMeta } from '@/types';

export interface SimilarScanResult {
  /** Groups of asset ids, each 2+ members, ordered oldest-first. */
  groups: string[][];
  /** Best-shot asset id per group (flat set — an id belongs to one group). */
  bestIds: string[];
  /** False when the native analyzer was unavailable (time-window fallback). */
  analyzerUsed: boolean;
}

/** 'compare' = feature-print grouping pass, 'analyze' = blur/face best-shot pass. */
export type ScanPhase = 'compare' | 'analyze';

export interface SimilarScanOptions {
  onProgress?: (processed: number, total: number, phase: ScanPhase) => void;
  /**
   * Streamed after every compare batch with ALL groups found so far — lets
   * the UI show results (and start reviews) seconds into a scan that may run
   * for many minutes on large libraries.
   */
  onGroups?: (groupsSoFar: string[][]) => void;
  /** Checked between native batches; true aborts the scan. */
  shouldAbort?: () => boolean;
}

// Plain macrotask yield. NOT InteractionManager: a long-running animation can
// starve runAfterInteractions indefinitely, stalling the scan mid-flight.
function yieldToJS(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Find groups of visually similar photos. Candidate groups come from
 * creation-time proximity (wide window); each candidate group is refined
 * on-device with Vision feature prints so only photos that actually look
 * alike stay grouped. Falls back to narrow time-window grouping when the
 * native analyzer is unavailable. Ported from cleani's getSimilarPhotosAI.
 */
export async function scanSimilarGroups(
  index: AssetMeta[],
  { onProgress, onGroups, shouldAbort }: SimilarScanOptions = {},
): Promise<SimilarScanResult | null> {
  const photos = index.filter((a) => a.mediaType === 'photo');

  // Vision feature prints silently fail on the iOS simulator (every print
  // comes back nil → zero groups), so the visual pass is device-only.
  const analyzerAvailable = Device.isDevice && isPhotoAnalyzerAvailable();
  if (!analyzerAvailable) {
    const groups = groupAssetsByTime(photos, SIMILAR.fastWindowSeconds * 1000).map((g) =>
      g.map((a) => a.id),
    );
    // Without blur/face data the best shot falls back to the last member
    const bestIds = groups
      .map((g) => g[g.length - 1])
      .filter((id): id is string => !!id);
    return { groups, bestIds, analyzerUsed: false };
  }

  const photoCount = photos.length;
  const newestCreationTime = photos.reduce((max, a) => Math.max(max, a.creationTime), 0);

  // Resume: a previous scan for this library state (deletions tolerated —
  // read-time filtering handles them) picks up mid-compare with everything it
  // had already found, instead of redoing minutes of Vision work.
  const resume = loadScanCheckpoint(photoCount, newestCreationTime);
  let refined: string[][];

  if (resume?.compareComplete) {
    refined = resume.groups;
    onGroups?.([...refined]);
  } else {
    const candidates = groupAssetsByTime(photos, SIMILAR.candidateWindowSeconds * 1000).map((g) =>
      g.map((a) => a.id),
    );
    const totalCandidatePhotos = candidates.reduce((sum, g) => sum + g.length, 0);

    // Skip whole candidate groups already covered by the checkpoint
    const found: string[][] = resume ? [...resume.groups] : [];
    let processedPhotos = 0;
    let firstUnprocessed = 0;
    if (resume) {
      while (
        firstUnprocessed < candidates.length &&
        processedPhotos + candidates[firstUnprocessed].length <= resume.processedCandidatePhotos
      ) {
        processedPhotos += candidates[firstUnprocessed].length;
        firstUnprocessed += 1;
      }
      onGroups?.([...found]);
    }
    onProgress?.(processedPhotos, totalCandidatePhotos, 'compare');

    let batch: string[][] = [];
    let batchPhotoCount = 0;
    let aborted = false;

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const groups = await PhotoAnalyzer.groupSimilarAssets(batch, SIMILAR.threshold);
      for (const group of groups) {
        if (group.length > 1) found.push(group);
      }
      processedPhotos += batchPhotoCount;
      batch = [];
      batchPhotoCount = 0;
      // Stream results + checkpoint after every batch: the UI fills up live,
      // and a killed app resumes here instead of starting over
      saveScanCheckpoint(photoCount, newestCreationTime, found, processedPhotos, false);
      onGroups?.([...found]);
      onProgress?.(processedPhotos, totalCandidatePhotos, 'compare');
      // Keep the JS thread responsive between heavy native calls
      await yieldToJS();
    };

    for (let i = firstUnprocessed; i < candidates.length; i++) {
      const group = candidates[i];
      if (shouldAbort?.()) {
        aborted = true;
        break;
      }
      if (batchPhotoCount + group.length > SIMILAR.maxPhotosPerNativeCall && batch.length > 0) {
        await flushBatch();
        if (shouldAbort?.()) {
          aborted = true;
          break;
        }
      }
      batch.push(group);
      batchPhotoCount += group.length;
    }
    if (!aborted) await flushBatch();
    if (aborted || shouldAbort?.()) return null;

    refined = found;
    saveScanCheckpoint(photoCount, newestCreationTime, refined, processedPhotos, true);
  }

  // Blur + face pass for best-shot selection (cache-first, chunked). On a
  // burst-heavy library this can cover thousands of photos and take minutes —
  // it MUST report progress or the scan looks hung at 100% of the compare phase.
  const cache = await backfillAnalysis(refined, shouldAbort, (processed, total) =>
    onProgress?.(processed, total, 'analyze'),
  );
  if (shouldAbort?.()) return null;
  const bestIds = Array.from(pickBestShots(refined, cache));

  // Full scan finished — the final result is persisted by the store
  clearScanCheckpoint();
  return { groups: refined, bestIds, analyzerUsed: true };
}
