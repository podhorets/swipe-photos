import { InteractionManager } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { createMMKV } from 'react-native-mmkv';
import type { AssetMeta } from '@/types';
import { STORAGE_KEYS, GALLERY } from '@/constants/config';

const storage = createMMKV();

// ─── Serialization ───────────────────────────────────────────────────────────

export function loadCachedIndex(): AssetMeta[] {
  const raw = storage.getString(STORAGE_KEYS.galleryIndex);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AssetMeta[];
  } catch {
    return [];
  }
}

function saveIndex(index: AssetMeta[]): void {
  storage.set(STORAGE_KEYS.galleryIndex, JSON.stringify(index));
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function assetToMeta(asset: MediaLibrary.Asset): AssetMeta {
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    mediaType: asset.mediaType,
    mediaSubtypes: asset.mediaSubtypes ?? [],
    creationTime: asset.creationTime,
    modificationTime: asset.modificationTime,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
  };
}

// ─── Build index ─────────────────────────────────────────────────────────────

export async function buildIndex(
  onProgress?: (loaded: number, total: number) => void,
): Promise<AssetMeta[]> {
  const allAssets: AssetMeta[] = [];
  let cursor: string | undefined;
  let hasNextPage = true;

  // Get total count upfront for progress reporting
  const { totalCount } = await MediaLibrary.getAssetsAsync({
    first: 1,
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
  });

  while (hasNextPage) {
    // Yield to the UI thread between pages so animations stay smooth
    await new Promise<void>((resolve) =>
      InteractionManager.runAfterInteractions(resolve),
    );

    const page = await MediaLibrary.getAssetsAsync({
      first: GALLERY.pageSize,
      after: cursor,
      // Newest first — if the library is huge we at least have recent photos
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    });

    for (const asset of page.assets) {
      allAssets.push(assetToMeta(asset));
    }

    hasNextPage = page.hasNextPage;
    cursor = page.endCursor;
    onProgress?.(allAssets.length, totalCount);
  }

  saveIndex(allAssets);
  return allAssets;
}

// ─── Incremental update ──────────────────────────────────────────────────────

/**
 * Removes deleted asset IDs from a cached index and appends any new ones.
 * Called from the MediaLibrary change listener.
 */
export function applyIndexDelta(
  current: AssetMeta[],
  delta: MediaLibrary.MediaLibraryAssetsChangeEvent,
): AssetMeta[] {
  if (!delta.hasIncrementalChanges) {
    // Full refresh needed — caller should trigger buildIndex()
    return current;
  }

  const deletedIds = new Set((delta.deletedAssets ?? []).map((a) => a.id));
  const filtered = current.filter((a) => !deletedIds.has(a.id));
  const inserted = (delta.insertedAssets ?? []).map(assetToMeta);

  const updated = [...inserted, ...filtered];
  saveIndex(updated);
  return updated;
}
