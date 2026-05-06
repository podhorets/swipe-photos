import { AVG_PHOTO_SIZE_BYTES, AVG_VIDEO_SIZE_BYTES } from "@/constants/config";
import type { AssetMeta } from "@/types";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

export function getEstimatedSize(mediaType: string): number {
  return mediaType === "video" ? AVG_VIDEO_SIZE_BYTES : AVG_PHOTO_SIZE_BYTES;
}

// Synchronous estimate from metadata already in the gallery index — zero I/O.
// A pano hits ~12 MB, a square thumbnail ~200 KB; far closer to reality than
// the flat 4 MB / 50 MB constants and good enough to display until the real
// on-disk size arrives lazily.
export function estimateSizeFromAsset(asset: AssetMeta): number {
  if (asset.mediaType === "video") {
    // bytes ≈ duration × bitrate. HEVC 1080p ≈ 10 Mbps; 4K ≈ 25 Mbps.
    const bitrate = asset.width >= 3000 ? 25_000_000 : 10_000_000;
    const seconds = Math.max(asset.duration, 1);
    return Math.round((seconds * bitrate) / 8);
  }
  const w = asset.width || 4032;
  const h = asset.height || 3024;
  // HEIC ≈ 0.25–0.35 bytes/pixel on iPhone captures.
  return Math.round(w * h * 0.3);
}

// Fetch the real on-disk size for a single asset. Falls back to a flat estimate
// on any failure. One bridge call per invocation — caller is responsible for
// scheduling (e.g. InteractionManager.runAfterInteractions) and deduping.
export async function fetchAssetSize(
  id: string,
  mediaType: string,
): Promise<number> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(id, {
      shouldDownloadFromNetwork: false,
    });
    if (info.localUri && !info.isNetworkAsset) {
      const file = new File(info.localUri);
      console.log('real ', file.size)
      if (file.exists) return file.size;
    }
  } catch {
    // fall through
  }
  console.log('estimated')
  return getEstimatedSize(mediaType);
}
