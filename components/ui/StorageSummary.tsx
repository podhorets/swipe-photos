import { GlassCard } from '@/components/glass/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { AVG_PHOTO_SIZE_BYTES, AVG_VIDEO_SIZE_BYTES } from '@/constants/config';
import { GRADIENTS } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';
import { computeStreak, getWeekCompletions } from '@/lib/streakUtils';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { useStatsStore } from '@/stores/statsStore';
import { useStreakStore } from '@/stores/streakStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Week-streak footer — 🔥 streak count + 7 day dots (complete = amber check,
 * today = ring). Moved in from the removed StreakWidget.tsx.
 */
function StreakFooter() {
  const completedDates = useStreakStore((s) => s.completedDates);

  const { weekCompletions, streak } = useMemo(
    () => ({
      weekCompletions: getWeekCompletions(completedDates, new Date()),
      streak: computeStreak(completedDates, new Date()),
    }),
    [completedDates],
  );

  const todayIndex = (() => {
    const day = new Date().getDay(); // 0=Sun … 6=Sat
    return day === 0 ? 6 : day - 1; // convert to Mon=0 … Sun=6
  })();

  return (
    <>
      <View className="h-px bg-white/[0.08]" />
      <View className="flex-row items-center justify-between px-4 pt-2.5 pb-3">
        {streak > 0 ? (
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[13px]">🔥</Text>
            <Text className="text-streak text-xs font-bold">{streak}-day streak</Text>
          </View>
        ) : (
          <Text className="text-white/50 text-xs font-semibold">This week</Text>
        )}
        <View className="flex-row gap-2.5">
          {DAY_LETTERS.map((letter, i) => {
            const completed = weekCompletions[i];
            const isToday = i === todayIndex;
            return (
              <View key={i} className="items-center gap-1">
                <Text
                  className={`text-[10px] font-semibold ${
                    isToday ? 'text-white/80' : 'text-white/35'
                  }`}
                >
                  {letter}
                </Text>
                <View
                  className="w-[18px] h-[18px] rounded-full items-center justify-center"
                  style={{
                    backgroundColor: completed ? '#FF9F0A' : 'rgba(255,255,255,0.08)',
                    borderWidth: isToday && !completed ? 1.5 : 0,
                    borderColor: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {completed && <Ionicons name="checkmark" size={10} color="#050508" />}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

/** One column of the labeled stat strip. */
function StatColumn({ label, value, green, last }: { label: string; value: string; green?: boolean; last?: boolean }) {
  return (
    <View className={last ? 'flex-1 items-center' : 'flex-1 items-center border-r border-white/[0.08]'}>
      <Text className="text-white/40 text-[10px] font-bold tracking-widest">{label}</Text>
      <Text className={green ? 'text-keep text-[15px] font-extrabold mt-0.5' : 'text-white text-[15px] font-extrabold mt-0.5'}>
        {value}
      </Text>
    </View>
  );
}

/** Hero storage card — reviewed ring + labeled stat columns + week-streak footer (5b). */
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
      // Distinct key: without it React reuses this GlassCard instance for the
      // loaded-summary branch below, and the Skia border can keep this card's
      // (shorter) stale size — a ghost border overlapping the summary card
      <GlassCard key="indexing" radius={28} className="mb-4">
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
    <GlassCard key="summary" radius={28} className="mb-4">
      {/* Headline */}
      <View className="px-4 pt-4 pb-3.5 flex-row items-center gap-[18px]">
        <ProgressRing
          size={96}
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
        <View className="flex-1">
          <Text className="text-white text-[22px] font-extrabold" style={{ letterSpacing: -0.4 }}>
            {index.length.toLocaleString()} items
          </Text>
          <Text className="text-white/45 text-[13px] mt-0.5">
            {formatBytes(estimatedSize, 0)} on device
          </Text>
        </View>
      </View>

      {/* Labeled stat columns */}
      <View className="flex-row mx-4 mb-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
        <StatColumn label="PHOTOS" value={photoCount.toLocaleString()} />
        <StatColumn label="VIDEOS" value={videoCount.toLocaleString()} />
        <StatColumn
          label="FREED"
          value={lifetimeFreedBytes > 0 ? formatBytes(lifetimeFreedBytes) : '—'}
          green={lifetimeFreedBytes > 0}
          last
        />
      </View>

      {/* Week streak strip (was StreakWidget) */}
      <StreakFooter />
    </GlassCard>
  );
}
