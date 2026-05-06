import { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { getByMonth } from '@/lib/gallery/grouper';
import { monthLabel } from '@/lib/dateUtils';
import { MonthRow } from '@/components/ui/MonthRow';
import { posthog } from '@/lib/posthog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthData {
  monthKey: string;
  label: string;
  count: number;
  progress: number;
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

  const months: MonthData[] = useMemo(() => {
    const grouped = getByMonth(index);
    return Array.from(grouped.entries()).map(([key, assets]) => {
      const keptCount = assets.filter((a) => keepIds.has(a.id)).length;
      return {
        monthKey: key,
        label: monthLabel(key),
        count: assets.length,
        progress: assets.length > 0 ? keptCount / assets.length : 0,
      };
    });
  }, [index, keepIds]);

  function handleMonthPress(yyyymm: string) {
    const monthData = months.find((m) => m.monthKey === yyyymm);
    posthog.capture('month_review_started', { month: yyyymm, photo_count: monthData?.count ?? 0 });
    router.push({ pathname: '/review/[sessionId]', params: { sessionId: 'month', month: yyyymm } });
  }

  if (months.length === 0) {
    return (
      <View className="flex-1 bg-black">
        <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-4">
          <Text className="text-white text-4xl font-bold">By Month</Text>
          <Text className="text-white/40 text-base mt-1">Browse your photos by month</Text>
        </View>
        <EmptyState />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <FlatList
        data={months}
        keyExtractor={(item) => item.monthKey}
        renderItem={({ item }) => (
          <MonthRow
            monthKey={item.monthKey}
            label={item.label}
            count={item.count}
            progress={item.progress}
            isComplete={item.progress >= 1}
            onPress={() => handleMonthPress(item.monthKey)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 24,
        }}
        ListHeaderComponent={
          <View className="mb-6">
            <Text className="text-white text-4xl font-bold">By Month</Text>
            <Text className="text-white/40 text-base mt-1">Browse your photos by month</Text>
            <Text className="text-white/30 text-sm mt-3">
              {months.length} month{months.length === 1 ? '' : 's'}
            </Text>
          </View>
        }
      />
    </View>
  );
}
