import { isPhotoAnalyzerAvailable, PhotoAnalyzer } from 'expo-photo-analyzer';
import { SIMILAR } from '@/constants/config';
import {
  AnalysisCache,
  idsNeedingAnalysis,
  loadAnalysisCache,
  saveAnalysisCache,
} from '@/lib/similar/analysisCache';

/**
 * Best shot of a group: among photos with detected faces (or all photos when
 * the group has none), the one with the highest sharpness. Groups without
 * analysis data fall back to the last photo (the one the deletion safety rule
 * kept historically in cleani).
 */
export function pickBestInGroup(groupIds: string[], cache: AnalysisCache): string | null {
  if (groupIds.length === 0) return null;

  const withFaces = groupIds.filter((id) => (cache[id]?.faceCount ?? 0) > 0);
  const pool = withFaces.length > 0 ? withFaces : groupIds;

  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const id of pool) {
    const score = cache[id]?.blurScore;
    if (score !== null && score !== undefined && score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId ?? pool[pool.length - 1] ?? null;
}

export function pickBestShots(groups: string[][], cache: AnalysisCache): Set<string> {
  const best = new Set<string>();
  for (const group of groups) {
    const id = pickBestInGroup(group, cache);
    if (id) best.add(id);
  }
  return best;
}

/**
 * Runs blur + face analysis for group members missing from the cache
 * (chunked to keep the bridge responsive) and returns the updated cache.
 * The cache is persisted after EVERY chunk: on a large library this pass
 * takes minutes, and saving only at the end meant a killed app redid all
 * of it on the next scan. No-op without the native analyzer.
 */
export async function backfillAnalysis(
  groups: string[][],
  shouldAbort?: () => boolean,
  onProgress?: (processed: number, total: number) => void,
): Promise<AnalysisCache> {
  const cache = loadAnalysisCache();
  if (!isPhotoAnalyzerAvailable()) return cache;

  const missing = [...new Set(idsNeedingAnalysis(groups.flat(), cache))];
  if (missing.length === 0) return cache;

  onProgress?.(0, missing.length);
  const now = Date.now();
  for (let i = 0; i < missing.length; i += SIMILAR.analysisChunkSize) {
    if (shouldAbort?.()) break;
    const chunk = missing.slice(i, i + SIMILAR.analysisChunkSize);
    const results = await PhotoAnalyzer.analyzeAssets(chunk, { blur: true, faces: true });
    for (const result of results) {
      cache[result.id] = {
        blurScore: result.error ? null : result.blurScore,
        faceCount: result.error ? null : result.faceCount,
        analyzedAt: now,
      };
    }
    saveAnalysisCache(cache);
    onProgress?.(Math.min(i + chunk.length, missing.length), missing.length);
  }

  return cache;
}
