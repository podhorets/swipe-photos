import type { AssetMeta } from "@/types";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

// Synchronous estimate from metadata already in the gallery index — zero I/O.
// Tuned for iPhone 17 Pro: 48 MP main sensor (8064×6048), HEIC high-efficiency,
// and ProRes/HEVC video up to 4K 60fps.
export function estimateSizeFromAsset(asset: AssetMeta): number {
  if (asset.mediaType === "video") {
    // iPhone 17 Pro 4K HEVC ≈ 80 Mbps; 1080p ≈ 25 Mbps.
    const bitrate = asset.width >= 3000 ? 80_000_000 : 25_000_000;
    const seconds = Math.max(asset.duration, 1);
    return Math.round((seconds * bitrate) / 8);
  }
  // 48 MP default when dimensions are missing.
  const w = asset.width || 8064;
  const h = asset.height || 6048;
  // HEIC high-quality on iPhone 17 Pro ≈ 0.5 bytes/pixel (~24 MB at full res).
  return Math.round(w * h * 0.5);
}

// Fetch the real on-disk size for a single asset. Falls back to a dimension-based
// estimate on any failure. One bridge call per invocation — caller is responsible
// for scheduling (e.g. InteractionManager.runAfterInteractions) and deduping.
export async function fetchAssetSize(asset: AssetMeta): Promise<number> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id, {
      shouldDownloadFromNetwork: false,
    });
    if (info.localUri && !info.isNetworkAsset) {
      const file = new File(info.localUri);
      console.log('real ', file.size);
      if (file.exists) return file.size;
    }
  } catch {
    // fall through
  }
  console.log('estimated');
  return estimateSizeFromAsset(asset);
}
