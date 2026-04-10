import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { useDeletionStore } from '@/stores/deletionStore';
import { StorageSummary } from '@/components/ui/StorageSummary';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { YearPicker, MonthPicker } from '@/components/ui/YearMonthPicker';
import {
  getOnThisDay,
  getScreenshots,
  getVideos,
  getFavorites,
} from '@/lib/gallery/grouper';
import type { Category } from '@/types';

interface CategoryDef {
  id: Category;
  label: string;
  icon: React.ComponentProps<typeof CategoryCard>['icon'];
  subtitle?: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'year',        label: 'By Year',       icon: 'file-tray-stacked-outline' },
  { id: 'month',       label: 'By Month',      icon: 'calendar-number-outline' },
  { id: 'on-this-day', label: 'On This Day',   icon: 'sparkles-outline', subtitle: 'Memories from past years' },
  { id: 'screenshots', label: 'Screenshots',   icon: 'phone-portrait-outline' },
  { id: 'videos',      label: 'Videos',        icon: 'videocam-outline' },
  { id: 'favorites',   label: 'Favorites',     icon: 'heart-outline' },
  { id: 'random',      label: 'Random Review', icon: 'shuffle-outline', subtitle: 'Random 50 from your library' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const favoriteIds = useGalleryStore((s) => s.favoriteIds);
  const isIndexing = useGalleryStore((s) => s.isIndexing);
  const staged = useDeletionStore((s) => s.staged);
  const stagedCount = staged.size;

  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  // Memoize counts so grouper functions only re-run when index/favoriteIds change
  const counts = useMemo(() => ({
    year:        index.length,
    month:       index.length,
    onThisDay:   getOnThisDay(index).length,
    screenshots: getScreenshots(index).length,
    videos:      getVideos(index).length,
    favorites:   getFavorites(index, favoriteIds).length,
    random:      index.length,
  }), [index, favoriteIds]);

  function countFor(id: Category): number {
    return counts[id === 'on-this-day' ? 'onThisDay' : id] ?? 0;
  }

  function handleCategoryPress(category: Category) {
    if (category === 'year') {
      setYearPickerVisible(true);
      return;
    }
    if (category === 'month') {
      setMonthPickerVisible(true);
      return;
    }
    router.push(`/review/${category}`);
  }

  function handleYearSelect(year: number) {
    setYearPickerVisible(false);
    router.push({ pathname: '/review/[sessionId]', params: { sessionId: 'year', year: String(year) } });
  }

  function handleMonthSelect(yyyymm: string) {
    setMonthPickerVisible(false);
    router.push({ pathname: '/review/[sessionId]', params: { sessionId: 'month', month: yyyymm } });
  }

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-start mb-6">
          <View className="flex-1">
            <Text className="text-white text-4xl font-bold">Swipe Photos</Text>
            <Text className="text-white/50 text-base mt-1">
              {index.length > 0
                ? 'Tap a category to start reviewing'
                : 'Loading your library…'}
            </Text>
          </View>

          {/* Trash badge — only shown when photos are staged */}
          {stagedCount > 0 && (
            <Pressable
              onPress={() => router.push('/trash')}
              className="items-center justify-center mt-1"
            >
              <View className="relative">
                <Ionicons name="trash-outline" size={28} color="rgba(255,255,255,0.7)" />
                <View className="absolute -top-1.5 -right-2 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-white text-xs font-bold leading-none">
                    {stagedCount > 99 ? '99+' : String(stagedCount)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>

        {/* Storage summary */}
        <StorageSummary />

        {/* Category list */}
        <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
          Review by category
        </Text>

        {CATEGORIES.map((cat) => {
          const count = countFor(cat.id);
          return (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              label={cat.label}
              icon={cat.icon}
              count={count}
              subtitle={cat.subtitle}
              disabled={!isIndexing && count === 0}
              loading={isIndexing && count === 0}
              onPress={() => handleCategoryPress(cat.id)}
            />
          );
        })}
      </ScrollView>

      <YearPicker
        visible={yearPickerVisible}
        onSelect={handleYearSelect}
        onClose={() => setYearPickerVisible(false)}
      />

      <MonthPicker
        visible={monthPickerVisible}
        onSelect={handleMonthSelect}
        onClose={() => setMonthPickerVisible(false)}
      />
    </View>
  );
}
