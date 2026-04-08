import { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGalleryStore } from '@/stores/galleryStore';
import { StorageSummary } from '@/components/ui/StorageSummary';
import { CategoryCard } from '@/components/ui/CategoryCard';
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
    router.push(`/review/${category}`);
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
        <View className="mb-6">
          <Text className="text-white text-4xl font-bold">Swipe Photos</Text>
          <Text className="text-white/50 text-base mt-1">
            {index.length > 0
              ? 'Tap a category to start reviewing'
              : 'Loading your library…'}
          </Text>
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
              disabled={count === 0}
              onPress={() => handleCategoryPress(cat.id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
