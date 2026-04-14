import { AVG_PHOTO_SIZE_BYTES, AVG_VIDEO_SIZE_BYTES } from "@/constants/config";
import { File } from 'expo-file-system';
import * as MediaLibrary from "expo-media-library";

export function getEstimatedSize(mediaType: string): number {
  return mediaType === "video" ? AVG_VIDEO_SIZE_BYTES : AVG_PHOTO_SIZE_BYTES;
}

export async function fetchAssetSizesInBackground(
  assetIdWithType: Map<string, string>,
  onSizeFound: (id: string, size: number) => void
): Promise<void> {
  for (const [id, type] of assetIdWithType.entries()) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(id, {
        shouldDownloadFromNetwork: false,
      });

      if (info.localUri && !info.isNetworkAsset) {
        const infoFile = new File(info.localUri);
        onSizeFound(id, infoFile.exists ? infoFile.size : getEstimatedSize(type));
      } else {
        onSizeFound(id, getEstimatedSize(type));
      }
    } catch {
      onSizeFound(id, getEstimatedSize(type));
    }
    
    // Yield to the JS macro-task queue (bridge) to allow UI / Gestures to process smoothly!
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
