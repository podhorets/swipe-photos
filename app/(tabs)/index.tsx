import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { useDeletionStore } from '@/stores/deletionStore';
import { useReviewedStore } from '@/stores/reviewedStore';
import { usePermissions } from '@/hooks/usePermissions';
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
  const { isMediaGranted, isMediaLimited } = usePermissions();

  const reviewedDecisions = useReviewedStore((s) => s.decisions);

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

  // Per-category progress (0–1). year/month/random are sub-grouped or infinite — no progress bar.
  const categoryProgress = useMemo(() => {
    const reviewedIds = new Set(reviewedDecisions.keys());

    function ratio(assets: { id: string }[]): number {
      if (assets.length === 0) return 0;
      return assets.filter((a) => reviewedIds.has(a.id)).length / assets.length;
    }

    return {
      screenshots: ratio(getScreenshots(index)),
      videos:      ratio(getVideos(index)),
      favorites:   ratio(getFavorites(index, favoriteIds)),
      'on-this-day': ratio(getOnThisDay(index)),
    } as Partial<Record<Category, number>>;
  }, [index, favoriteIds, reviewedDecisions]);

  function countFor(id: Category): number {
    return counts[id === 'on-this-day' ? 'onThisDay' : id] ?? 0;
  }

  function handleCategoryPress(category: Category) {
    const count = countFor(category);
    if (!isIndexing && count === 0) {
      const cat = CATEGORIES.find((c) => c.id === category);
      Alert.alert('Nothing Here', `No photos in "${cat?.label ?? category}" yet.`);
      return;
    }
    const progress = categoryProgress[category];
    if (progress !== undefined && progress >= 1) {
      Alert.alert('All Photos Reviewed', 'You\'ve reviewed all photos in this category.', [
        { text: 'OK' },
      ]);
      return;
    }
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

  // Permission denied — show locked state with Settings deep link
  if (!isMediaGranted) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8" style={{ paddingTop: insets.top }}>
        <Ionicons name="lock-closed-outline" size={64} color="rgba(255,255,255,0.2)" />
        <Text className="text-white text-2xl font-bold mt-6 text-center">Photo Access Required</Text>
        <Text className="text-white/50 text-base mt-3 text-center leading-6">
          Swipe Photos needs access to your library to help you review and clean up photos.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          className="mt-8 bg-white/15 rounded-2xl px-8 py-4"
        >
          <Text className="text-white font-semibold text-base">Open Settings</Text>
        </Pressable>
      </View>
    );
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

        {/* Limited access banner */}
        {isMediaLimited && (
          <Pressable
            onPress={() => Linking.openSettings()}
            className="flex-row items-center gap-3 rounded-2xl px-4 py-3 mb-4"
            style={{ backgroundColor: 'rgba(234,179,8,0.12)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.25)' }}
          >
            <Ionicons name="warning-outline" size={20} color="rgba(234,179,8,0.8)" />
            <View className="flex-1">
              <Text className="text-yellow-400 text-sm font-semibold">Limited photo access</Text>
              <Text className="text-yellow-400/70 text-xs mt-0.5">
                You've granted access to {index.length.toLocaleString()} photos. Tap to expand in Settings.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(234,179,8,0.4)" />
          </Pressable>
        )}

        {/* Storage summary */}
        <StorageSummary />

        {/* Category list */}
        <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
          Review by category
        </Text>

        {CATEGORIES.map((cat) => {
          const count = countFor(cat.id);
          const progress = categoryProgress[cat.id];
          return (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              label={cat.label}
              icon={cat.icon}
              count={count}
              subtitle={cat.subtitle}
              progress={progress}
              isComplete={progress !== undefined && progress >= 1}
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
