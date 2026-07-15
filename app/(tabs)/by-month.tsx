import { useMemo } from 'react';
import { View, Text, SectionList } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { getByMonth } from '@/lib/gallery/grouper';
import { monthLabel } from '@/lib/dateUtils';
import { MonthRow } from '@/components/ui/MonthRow';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { posthog } from '@/lib/posthog';
import { gateSessionStart } from '@/lib/sessionGate';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthData {
  monthKey: string;
  label: string;
  count: number;
  progress: number;
  coverUri?: string;
}

interface YearSection {
  title: string;
  data: MonthData[];
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name="calendar-number-outline" size={64} color="rgba(255,255,255,0.12)" />
      <Text className="text-white text-xl font-semibold text-center">No photos yet</Text>
      <Text className="text-white/40 text-base text-center">
        Photos from your library will be grouped here by month.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ByMonthScreen() {
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const keepIds = useKeepStore((s) => s.keepIds);

  const { sections, monthCount, itemCount } = useMemo(() => {
    const grouped = getByMonth(index);
    const keys = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a)); // newest first
    const byYear = new Map<string, MonthData[]>();
    let items = 0;
    for (const key of keys) {
      const assets = grouped.get(key)!;
      const keptCount = assets.filter((a) => keepIds.has(a.id)).length;
      const year = key.slice(0, 4);
      items += assets.length;
      const month: MonthData = {
        monthKey: key,
        label: monthLabel(key),
        count: assets.length,
        progress: assets.length > 0 ? keptCount / assets.length : 0,
        coverUri: assets[0]?.uri,
      };
      const list = byYear.get(year);
      if (list) list.push(month);
      else byYear.set(year, [month]);
    }
    return {
      sections: Array.from(byYear.entries()).map(([title, data]): YearSection => ({ title, data })),
      monthCount: keys.length,
      itemCount: items,
    };
  }, [index, keepIds]);

  function handleMonthPress(yyyymm: string, count: number) {
    if (!gateSessionStart()) return;
    posthog.capture('month_review_started', { month: yyyymm, photo_count: count });
    router.push({ pathname: '/review/[sessionId]', params: { sessionId: 'month', month: yyyymm } });
  }

  const header = (
    <View className="mb-5">
      <Text className="text-white text-[34px] font-extrabold" style={{ letterSpacing: -0.8 }}>
        By Month
      </Text>
      <Text className="text-white/45 text-[15px] mt-1">
        {monthCount > 0
          ? `${monthCount} month${monthCount === 1 ? '' : 's'} · ${itemCount.toLocaleString()} items`
          : 'Browse your photos by month'}
      </Text>
    </View>
  );

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-bg-dark">
        <AuroraBackground variant="by-month" />
        <View style={{ paddingTop: insets.top + 16 }} className="px-5 pb-4">
          {header}
        </View>
        <EmptyState />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="by-month" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.monthKey}
        renderItem={({ item }) => (
          <MonthRow
            monthKey={item.monthKey}
            label={item.label}
            count={item.count}
            progress={item.progress}
            isComplete={item.progress >= 1}
            coverUri={item.coverUri}
            onPress={() => handleMonthPress(item.monthKey, item.count)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text
            className="text-white/40 text-[13px] font-bold mb-2.5 mt-2"
            style={{ letterSpacing: 1.3 }}
          >
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: 20,
        }}
        ListHeaderComponent={header}
      />
    </View>
  );
}
