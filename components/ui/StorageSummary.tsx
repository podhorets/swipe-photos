import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { formatBytes } from '@/lib/dateUtils';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { computeStreak, getWeekCompletions } from '@/lib/streakUtils';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { useStatsStore } from '@/stores/statsStore';
import { useStreakStore } from '@/stores/streakStore';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Week-streak footer — streak count + 7 day dots (complete = amber with a
 * dark check, today = ring).
 */
function StreakFooter() {
  const t = useTheme();
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
      <View className="h-px bg-divider" />
      <View className="flex-row items-center justify-between px-3.5 pt-2 pb-2.5">
        {streak > 0 ? (
          <View className="flex-row items-center gap-1">
            <Icon name="flame" size={13} color={t.streak.text} fill={t.streak.flame} strokeWidth={1.8} />
            <Text className="text-streak-fg text-[12px] font-bold">{streak}-day streak</Text>
          </View>
        ) : (
          <Text className="text-fg-2 text-[12px] font-bold">This week</Text>
        )}
        <View className="flex-row gap-1.5">
          {DAY_LETTERS.map((letter, i) => {
            const completed = weekCompletions[i];
            const isToday = i === todayIndex;
            return (
              <View key={i} className="items-center gap-[3px]">
                <Text className={`text-[9.5px] font-semibold ${isToday ? 'text-fg' : 'text-fg-2'}`}>{letter}</Text>
                <View
                  className={`w-5 h-5 rounded-full items-center justify-center ${
                    completed ? 'bg-dot-done' : isToday ? 'border-2 border-fg' : 'bg-dot-off'
                  }`}
                >
                  {completed && <Icon name="check" size={12} color={t.dot.doneFg} strokeWidth={3} />}
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
    <Text className="text-fg-2 text-[13px]">
      {label}{' '}
      <Text className={green ? 'text-keep-text font-bold' : 'text-fg font-bold'}>{value}</Text>
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
      <Card className="p-3.5">
        <Text className="text-fg-2 text-sm mb-2">Scanning library…</Text>
        <View className="h-1 bg-track rounded-full overflow-hidden">
          <View className="h-full bg-accent rounded-full" style={{ width: `${Math.round(indexProgress * 100)}%` }} />
        </View>
        {index.length > 0 && (
          <Text className="text-fg-2 text-xs mt-2">{index.length.toLocaleString()} found so far…</Text>
        )}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <View className="px-3.5 pt-[13px] pb-3 gap-2.5">
        <View className="flex-row items-baseline justify-between">
          <Text className="font-display text-fg text-[22px]">{Math.round(reviewedRatio * 100)}% reviewed</Text>
          <Text className="text-fg-2 text-[12.5px]">
            {index.length.toLocaleString()} items · {formatBytes(estimatedSize, 0)}
          </Text>
        </View>

        <View className="h-1 bg-track rounded-full overflow-hidden">
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

      <StreakFooter />
    </Card>
  );
}
