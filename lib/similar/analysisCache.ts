import { createMMKV } from 'react-native-mmkv';
import { SIMILAR, STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

export interface AnalysisRecord {
  /** Variance of the Laplacian — higher is sharper. Null when analysis failed. */
  blurScore: number | null;
  faceCount: number | null;
  analyzedAt: number;
}

export type AnalysisCache = Record<string, AnalysisRecord>;

export function loadAnalysisCache(): AnalysisCache {
  const raw = storage.getString(STORAGE_KEYS.similarAnalysis);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AnalysisCache;
  } catch {
    return {};
  }
}

export function saveAnalysisCache(cache: AnalysisCache): void {
  storage.set(STORAGE_KEYS.similarAnalysis, JSON.stringify(cache));
}

/**
 * Asset ids that still need a blur/face pass: never analyzed, or a failed
 * analysis (both scores null — e.g. iCloud-offloaded) old enough to retry.
 */
export function idsNeedingAnalysis(ids: string[], cache: AnalysisCache, now = Date.now()): string[] {
  return ids.filter((id) => {
    const rec = cache[id];
    if (!rec) return true;
    const failed = rec.blurScore === null && rec.faceCount === null;
    return failed && now - rec.analyzedAt > SIMILAR.analysisRetryMs;
  });
}
