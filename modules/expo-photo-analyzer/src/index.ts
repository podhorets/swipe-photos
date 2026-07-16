import { requireNativeModule } from "expo-modules-core";

export type AssetAnalysis = {
  id: string;
  /** Variance of the Laplacian — lower is blurrier. Null when not computed. */
  blurScore: number | null;
  faceCount: number | null;
  error: string | null;
};

export type AnalyzeOptions = {
  blur?: boolean;
  faces?: boolean;
  maxDimension?: number;
};

type NativePhotoAnalyzer = {
  analyzeAssets(
    assetIds: string[],
    options?: AnalyzeOptions,
  ): Promise<AssetAnalysis[]>;
  groupSimilarAssets(
    candidateGroups: string[][],
    threshold: number,
  ): Promise<string[][]>;
};

// The native module only exists in dev clients / builds produced after the
// module was added (and only on iOS). Callers must check availability and
// fall back to non-AI behavior instead of crashing older binaries.
let nativeModule: NativePhotoAnalyzer | null = null;
try {
  nativeModule = requireNativeModule("PhotoAnalyzer");
} catch {
  nativeModule = null;
}

export function isPhotoAnalyzerAvailable(): boolean {
  return nativeModule != null;
}

function getNative(): NativePhotoAnalyzer {
  if (!nativeModule) {
    throw new Error(
      "PhotoAnalyzer native module is not available in this build.",
    );
  }
  return nativeModule;
}

/**
 * Analyzes photos by MediaLibrary asset id. Returns one entry per id, in the
 * same order. Assets that cannot be analyzed carry an `error` string.
 */
function analyzeAssets(
  assetIds: string[],
  options?: AnalyzeOptions,
): Promise<AssetAnalysis[]> {
  return getNative().analyzeAssets(assetIds, options);
}

/**
 * Refines candidate groups (photos close in time) into groups of visually
 * similar photos using Vision feature prints. Order within groups is
 * preserved; only sub-groups with 2+ members are returned.
 * @param threshold Max feature-print distance to treat photos as similar.
 */
function groupSimilarAssets(
  candidateGroups: string[][],
  threshold: number,
): Promise<string[][]> {
  return getNative().groupSimilarAssets(candidateGroups, threshold);
}

export const PhotoAnalyzer = {
  analyzeAssets,
  groupSimilarAssets,
};
