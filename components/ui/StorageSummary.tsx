import { GlassCard } from '@/components/glass/GlassCard';
import { formatBytes } from '@/lib/dateUtils';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
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

/** One inline fact of the stat row: muted label, bold value. */
function StatInline({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <Text className="text-white/50 text-[13px]">
      {label}{' '}
      <Text className={green ? 'text-keep font-bold' : 'text-white font-bold'}>{value}</Text>
    </Text>
  );
}

/** Hero storage card — reviewed headline + progress bar + inline stats + week-streak footer. */
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
      // Per-asset estimate from dimensions/duration (same model the trash
      // uses before real sizes arrive) — a flat 4 MB/photo was off by 10× on
      // libraries of smaller images
      estimatedSize: index.reduce((sum, a) => sum + estimateSizeFromAsset(a), 0),
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
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-white text-[20px] font-extrabold" style={{ letterSpacing: -0.4 }}>
            {Math.round(reviewedRatio * 100)}% reviewed
          </Text>
          <Text className="text-white/50 text-[13px]">
            {index.length.toLocaleString()} items · {formatBytes(estimatedSize, 0)}
          </Text>
        </View>

        <View className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2.5 mb-3">
          <View
            className="h-full bg-accent rounded-full"
            // A sliver stays visible once anything is reviewed
            style={{ width: `${reviewedRatio > 0 ? Math.max(2, reviewedRatio * 100) : 0}%` }}
          />
        </View>

        <View className="flex-row justify-between">
          <StatInline label="Photos" value={photoCount.toLocaleString()} />
          <StatInline label="Videos" value={videoCount.toLocaleString()} />
          <StatInline
            label="Freed"
            value={lifetimeFreedBytes > 0 ? formatBytes(lifetimeFreedBytes) : '—'}
            green={lifetimeFreedBytes > 0}
          />
        </View>
      </View>

      {/* Week streak strip (was StreakWidget) */}
      <StreakFooter />
    </GlassCard>
  );
}
