import { useMemo } from 'react';
import {View, Text, ScrollView, Pressable, Linking, Alert, Button} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { usePermissions } from '@/hooks/usePermissions';
import { StorageSummary } from '@/components/ui/StorageSummary';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { GlassCard } from '@/components/glass/GlassCard';
import { StreakWidget } from '@/components/ui/StreakWidget';
import {
  getOnThisDay,
  getScreenshots,
  getVideos,
} from '@/lib/gallery/grouper';
import type { Category } from '@/types';
import * as Sentry from '@sentry/react-native';
import { posthog } from '@/lib/posthog';

interface CategoryDef {
  id: Category;
  label: string;
  icon: React.ComponentProps<typeof CategoryCard>['icon'];
  subtitle?: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'on-this-day', label: 'On This Day',   icon: 'sparkles-outline', subtitle: 'Memories from past years' },
  { id: 'screenshots', label: 'Screenshots',   icon: 'phone-portrait-outline' },
  { id: 'videos',      label: 'Videos',        icon: 'videocam-outline' },
  { id: 'random',      label: 'Random Review', icon: 'shuffle-outline', subtitle: 'Random 50 from your library' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const isIndexing = useGalleryStore((s) => s.isIndexing);
  const keepIds = useKeepStore((s) => s.keepIds);
  const { isMediaGranted, isMediaLimited } = usePermissions();

  // Memoize counts so grouper functions only re-run when index changes
  const counts = useMemo(() => ({
    'on-this-day': getOnThisDay(index).length,
    screenshots:   getScreenshots(index).length,
    videos:        getVideos(index).length,
    random:        index.length,
  }), [index]);

  // Per-category progress (0–1): ratio of kept items to total in category.
  const categoryProgress = useMemo(() => {
    function ratio(assets: { id: string }[]): number {
      if (assets.length === 0) return 0;
      return assets.filter((a) => keepIds.has(a.id)).length / assets.length;
    }

    return {
      screenshots:   ratio(getScreenshots(index)),
      videos:        ratio(getVideos(index)),
      'on-this-day': ratio(getOnThisDay(index)),
    } as Partial<Record<Category, number>>;
  }, [index, keepIds]);

  function countFor(id: Category): number {
    return counts[id as keyof typeof counts] ?? 0;
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
    posthog.capture('review_session_started', { category, photo_count: countFor(category) });
    router.push(`/review/${category}`);
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
        </View>
        <Button title='Try!' onPress={ () => { Sentry.captureException(new Error('First error')) }}/>

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

        {/* Streak widget */}
        <StreakWidget />

        {/* By Month — navigates to dedicated tab */}
        <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
          Browse by time
        </Text>
        <Pressable onPress={() => router.navigate('/(tabs)/by-month')} className="active:opacity-70">
          <GlassCard className="mb-3">
            <View className="p-4 flex-row items-center gap-4">
              <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
                <Ionicons name="calendar-number-outline" size={24} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">By Month</Text>
                <Text className="text-white/50 text-sm mt-0.5">
                  {index.length > 0
                    ? `${index.length.toLocaleString()} items across your library`
                    : 'Browse photos month by month'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </View>
          </GlassCard>
        </Pressable>

        {/* Category list */}
        <Text className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3 mt-2">
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
    </View>
  );
}
