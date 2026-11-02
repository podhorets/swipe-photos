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

export type AssetLocation = {
  id: string;
  latitude: number;
  longitude: number;
};

type NativePhotoAnalyzer = {
  getAssetLocations(assetIds: string[]): Promise<AssetLocation[]>;
  getFavoriteIds(assetIds: string[]): Promise<string[]>;
  setFavorite(assetIds: string[], favorite: boolean): Promise<boolean>;
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

/**
 * GPS coordinates for many assets in one call, read from photo metadata on
 * the device (no image files opened, nothing sent anywhere). Only assets that
 * have a location are returned.
 */
function getAssetLocations(assetIds: string[]): Promise<AssetLocation[]> {
  return getNative().getAssetLocations(assetIds);
}

/** Ids among the given assets that are Favorites in the Photos app. */
function getFavoriteIds(assetIds: string[]): Promise<string[]> {
  return getNative().getFavoriteIds(assetIds);
}

/** Adds assets to (or removes them from) Favorites in the Photos app. */
function setFavorite(assetIds: string[], favorite: boolean): Promise<boolean> {
  return getNative().setFavorite(assetIds, favorite);
}

export const PhotoAnalyzer = {
  analyzeAssets,
  groupSimilarAssets,
  getAssetLocations,
  getFavoriteIds,
  setFavorite,
};
