import { InteractionManager } from 'react-native';
import * as Device from 'expo-device';
import { isPhotoAnalyzerAvailable, PhotoAnalyzer } from 'expo-photo-analyzer';
import { SIMILAR } from '@/constants/config';
import { groupAssetsByTime } from '@/lib/similar/timeGroups';
import { backfillAnalysis, pickBestShots } from '@/lib/similar/bestShot';
import type { AssetMeta } from '@/types';

export interface SimilarScanResult {
  /** Groups of asset ids, each 2+ members, ordered oldest-first. */
  groups: string[][];
  /** Best-shot asset id per group (flat set — an id belongs to one group). */
  bestIds: string[];
  /** False when the native analyzer was unavailable (time-window fallback). */
  analyzerUsed: boolean;
}

export interface SimilarScanOptions {
  onProgress?: (processed: number, total: number) => void;
  /** Checked between native batches; true aborts the scan. */
  shouldAbort?: () => boolean;
}

function yieldToInteractions(): Promise<void> {
  return new Promise((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
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
  { onProgress, shouldAbort }: SimilarScanOptions = {},
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

  const candidates = groupAssetsByTime(photos, SIMILAR.candidateWindowSeconds * 1000).map((g) =>
    g.map((a) => a.id),
  );
  const totalCandidatePhotos = candidates.reduce((sum, g) => sum + g.length, 0);
  let processedPhotos = 0;
  onProgress?.(0, totalCandidatePhotos);

  const refined: string[][] = [];
  let batch: string[][] = [];
  let batchPhotoCount = 0;
  let aborted = false;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const groups = await PhotoAnalyzer.groupSimilarAssets(batch, SIMILAR.threshold);
    for (const group of groups) {
      if (group.length > 1) refined.push(group);
    }
    processedPhotos += batchPhotoCount;
    batch = [];
    batchPhotoCount = 0;
    onProgress?.(processedPhotos, totalCandidatePhotos);
    // Keep the UI thread responsive between heavy native calls
    await yieldToInteractions();
  };

  for (const group of candidates) {
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

  // Blur + face pass for best-shot selection (cache-first, chunked)
  const cache = await backfillAnalysis(refined, shouldAbort);
  if (shouldAbort?.()) return null;
  const bestIds = Array.from(pickBestShots(refined, cache));

  return { groups: refined, bestIds, analyzerUsed: true };
}
