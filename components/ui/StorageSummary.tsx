import { View, Text } from 'react-native';
import { GlassCard } from '@/components/glass/GlassCard';
import { useGalleryStore } from '@/stores/galleryStore';
import { formatBytes } from '@/lib/dateUtils';
import { AVG_PHOTO_SIZE_BYTES, AVG_VIDEO_SIZE_BYTES } from '@/constants/config';

export function StorageSummary() {
  const { index, isIndexing, indexProgress } = useGalleryStore();

  const photoCount = index.filter((a) => a.mediaType === 'photo').length;
  const videoCount = index.filter((a) => a.mediaType === 'video').length;

  // Rough estimate: sum of avg sizes
  const estimatedSize =
    photoCount * AVG_PHOTO_SIZE_BYTES + videoCount * AVG_VIDEO_SIZE_BYTES;

  return (
    <GlassCard className="mb-6">
      <View className="p-4">
        {isIndexing ? (
          <>
            <Text className="text-white/60 text-sm mb-2">Scanning library…</Text>
            {/* Progress bar */}
            <View className="h-1 bg-white/10 rounded-full overflow-hidden">
              <View
                className="h-full bg-white rounded-full"
                style={{ width: `${Math.round(indexProgress * 100)}%` }}
              />
            </View>
            {index.length > 0 && (
              <Text className="text-white/40 text-xs mt-2">
                {index.length.toLocaleString()} found so far…
              </Text>
            )}
          </>
        ) : (
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white text-2xl font-bold">
                {index.length.toLocaleString()}
              </Text>
              <Text className="text-white/50 text-sm mt-0.5">
                {photoCount.toLocaleString()} photos · {videoCount.toLocaleString()} videos
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-white/40 text-xs">Est. size</Text>
              <Text className="text-white/70 text-base font-semibold mt-0.5">
                {formatBytes(estimatedSize)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </GlassCard>
  );
}
