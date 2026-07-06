import { useMemo } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassCard } from '@/components/glass/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { useStatsStore } from '@/stores/statsStore';
import { GRADIENTS } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';
import { AVG_PHOTO_SIZE_BYTES, AVG_VIDEO_SIZE_BYTES } from '@/constants/config';

/** Hero storage card — reviewed ring + library totals + all-time freed. */
export function StorageSummary() {
  const index = useGalleryStore((s) => s.index);
  const isIndexing = useGalleryStore((s) => s.isIndexing);
  const indexProgress = useGalleryStore((s) => s.indexProgress);
  const keepIds = useKeepStore((s) => s.keepIds);
  const lifetimeFreedBytes = useStatsStore((s) => s.lifetimeFreedBytes);

  const { photoCount, videoCount, estimatedSize, reviewedRatio } = useMemo(() => {
    const photos = index.filter((a) => a.mediaType === 'photo').length;
    const videos = index.filter((a) => a.mediaType === 'video').length;
    return {
      photoCount: photos,
      videoCount: videos,
      estimatedSize: photos * AVG_PHOTO_SIZE_BYTES + videos * AVG_VIDEO_SIZE_BYTES,
      reviewedRatio: index.length > 0 ? Math.min(1, keepIds.size / index.length) : 0,
    };
  }, [index, keepIds]);

  if (isIndexing) {
    return (
      <GlassCard radius={28} className="mb-3">
        <View className="p-4">
          <Text className="text-white/60 text-sm mb-2">Scanning library…</Text>
          <View className="h-1 bg-white/10 rounded-full overflow-hidden">
            <View
              className="h-full bg-accent rounded-full"
              style={{ width: `${Math.round(indexProgress * 100)}%` }}
            />
          </View>
          {index.length > 0 && (
            <Text className="text-white/40 text-xs mt-2">
              {index.length.toLocaleString()} found so far…
            </Text>
          )}
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard radius={28} className="mb-3">
      <View className="p-4 flex-row items-center gap-[18px]">
        <ProgressRing
          size={104}
          radius={44}
          strokeWidth={9}
          progress={reviewedRatio}
          gradientColors={GRADIENTS.accent}
        >
          <Text className="text-white text-[21px] font-extrabold">
            {Math.round(reviewedRatio * 100)}%
          </Text>
          <Text className="text-white/45 text-[10px] font-semibold">REVIEWED</Text>
        </ProgressRing>
        <View className="flex-1 gap-2.5">
          <View>
            <Text className="text-white text-[22px] font-extrabold" style={{ letterSpacing: -0.4 }}>
              {index.length.toLocaleString()} items
            </Text>
            <Text className="text-white/45 text-[13px] mt-px">
              {formatBytes(estimatedSize)} · {photoCount.toLocaleString()} photos ·{' '}
              {videoCount.toLocaleString()} videos
            </Text>
          </View>
          {lifetimeFreedBytes > 0 && (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="sparkles" size={13} color="#30D158" />
              <Text className="text-keep text-[13px] font-semibold">
                {formatBytes(lifetimeFreedBytes)} freed all-time
              </Text>
            </View>
          )}
        </View>
      </View>
    </GlassCard>
  );
}
