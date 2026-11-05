import { useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { getByMonth } from '@/lib/gallery/grouper';
import { monthLabel } from '@/lib/dateUtils';
import { MonthRow } from '@/components/ui/MonthRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LibraryTypes } from '@/components/library/LibraryTypes';
import { EmptyState as Empty } from '@/components/ui/EmptyState';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StatusBarScrim } from '@/components/ui/StatusBarScrim';
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
    <View className="flex-1 items-center justify-center pb-24">
      <Empty icon="calendar" title="No photos yet" body="Photos from your library will be grouped here by month." />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const VIEWS = ['Months', 'Types'] as const;
type LibraryView = (typeof VIEWS)[number];

/** Library tab: months (the old Months tab) or every stack type plus places. */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<LibraryView>('Months');
  // Home's By Year / By Location shortcuts pick the view; `at` changes on every tap
  const params = useLocalSearchParams<{ view?: string; at?: string }>();
  useEffect(() => {
    if (params.view === 'Months' || params.view === 'Types') setView(params.view);
  }, [params.view, params.at]);
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
    <View>
      <Text className="font-display text-fg text-[34px] leading-[37px]">Library</Text>
      <Text className="text-fg-2 text-[14.5px] mt-[3px]">
        {monthCount > 0
          ? `${monthCount} month${monthCount === 1 ? '' : 's'} · ${itemCount.toLocaleString()} items`
          : 'Browse your photos by month'}
      </Text>
      <View className="mt-4">
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
      </View>
    </View>
  );

  const contentStyle = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 110,
    paddingHorizontal: 21,
  };

  if (sections.length === 0) {
    return (
      <View className="flex-1">
        <ScreenBackground />
        <View style={{ paddingTop: insets.top + 12 }} className="px-[21px] pb-4">
          {header}
        </View>
        <EmptyState />
      </View>
    );
  }

  if (view === 'Types') {
    return (
      <View className="flex-1">
        <ScreenBackground />
        <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
          {header}
          <LibraryTypes />
        </ScrollView>
        <StatusBarScrim />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScreenBackground />
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
          <Text className="text-fg-2 text-[12px] font-bold mt-[26px] mb-2 ml-0.5" style={{ letterSpacing: 1.4 }}>
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={header}
      />
      <StatusBarScrim />
    </View>
  );
}
