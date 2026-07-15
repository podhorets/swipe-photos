import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePermissions } from '@/hooks/usePermissions';
import { StorageSummary } from '@/components/ui/StorageSummary';
import { StreakWidget } from '@/components/ui/StreakWidget';
import { StreakChip } from '@/components/ui/StreakChip';
import { SessionsChip } from '@/components/ui/SessionsChip';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { IconSquircle } from '@/components/ui/IconSquircle';
import { GlassCard } from '@/components/glass/GlassCard';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import {
  getByMonth,
  getOnThisDay,
  getScreenshots,
  getVideos,
} from '@/lib/gallery/grouper';
import { GRADIENTS, SCREEN } from '@/constants/theme';
import { formatBytes, monthLabel } from '@/lib/dateUtils';
import { AVG_VIDEO_SIZE_BYTES } from '@/constants/config';
import type { Category } from '@/types';
import { posthog } from '@/lib/posthog';
import { gateSessionStart } from '@/lib/sessionGate';
import { usePlanStore } from '@/stores/planStore';
import { effectiveBatchSize } from '@/lib/planUtils';

const TILE_WIDTH = (SCREEN.width - 40 - 12) / 2; // px-5 screen padding, gap-3

interface TileDef {
  id: Category;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const isIndexing = useGalleryStore((s) => s.isIndexing);
  const keepIds = useKeepStore((s) => s.keepIds);
  const batchSize = useSettingsStore((s) => s.batchSize);
  const planState = usePlanStore();
  const { isMediaGranted, isMediaLimited } = usePermissions();

  // Free plan clamps the tile label to match the actual session size
  const displayBatchSize = effectiveBatchSize(planState, batchSize);

  const tiles: TileDef[] = useMemo(
    () => [
      { id: 'on-this-day', label: 'On This Day', icon: 'sparkles' },
      { id: 'screenshots', label: 'Screenshots', icon: 'phone-portrait-outline' },
      { id: 'videos', label: 'Videos', icon: 'videocam' },
      { id: 'random', label: `Random ${displayBatchSize}`, icon: 'shuffle' },
    ],
    [displayBatchSize],
  );

  // Counts + cover photos per category, and by-month meta — one pass per index change
  const { counts, covers, videoBytes, monthMeta } = useMemo(() => {
    const onThisDay = getOnThisDay(index);
    const screenshots = getScreenshots(index);
    const videos = getVideos(index);
    const byMonth = getByMonth(index);
    const monthKeys = Array.from(byMonth.keys()).sort();
    return {
      counts: {
        'on-this-day': onThisDay.length,
        screenshots: screenshots.length,
        videos: videos.length,
        random: index.length,
      },
      covers: {
        'on-this-day': onThisDay[0]?.uri,
        screenshots: screenshots[0]?.uri,
        videos: videos[0]?.uri,
        random: index[0]?.uri,
      },
      videoBytes: videos.length * AVG_VIDEO_SIZE_BYTES,
      monthMeta: {
        count: byMonth.size,
        oldestLabel: monthKeys.length > 0 ? monthLabel(monthKeys[0]) : undefined,
      },
    };
  }, [index]);

  // Per-category progress (0–1): ratio of kept items to total in category.
  const categoryProgress = useMemo(() => {
    function ratio(assets: { id: string }[]): number {
      if (assets.length === 0) return 0;
      return assets.filter((a) => keepIds.has(a.id)).length / assets.length;
    }

    return {
      screenshots: ratio(getScreenshots(index)),
      videos: ratio(getVideos(index)),
      'on-this-day': ratio(getOnThisDay(index)),
    } as Partial<Record<Category, number>>;
  }, [index, keepIds]);

  function countFor(id: Category): number {
    return counts[id as keyof typeof counts] ?? 0;
  }

  function handleCategoryPress(category: Category) {
    const count = countFor(category);
    if (!isIndexing && count === 0) {
      const tile = tiles.find((t) => t.id === category);
      Alert.alert('Nothing Here', `No photos in "${tile?.label ?? category}" yet.`);
      return;
    }
    const progress = categoryProgress[category];
    if (progress !== undefined && progress >= 1) {
      Alert.alert('All Photos Reviewed', 'You\'ve reviewed all photos in this category.', [
        { text: 'OK' },
      ]);
      return;
    }
    if (!gateSessionStart()) return;
    posthog.capture('review_session_started', { category, photo_count: countFor(category) });
    router.push(`/review/${category}`);
  }

  const dateLine = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const monthDay = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  // Data-driven tile subtitles, per the design mock
  function subtitleFor(id: Category): string {
    switch (id) {
      case 'on-this-day':
        return `Memories from ${monthDay}`;
      case 'screenshots':
        return `${Math.round((categoryProgress.screenshots ?? 0) * 100)}% reviewed`;
      case 'videos':
        return `${formatBytes(videoBytes)} total`;
      default:
        return 'Quick 5-min session';
    }
  }

  // Permission denied — show locked state with Settings deep link
  if (!isMediaGranted) {
    return (
      <View className="flex-1 bg-bg-dark items-center justify-center px-8" style={{ paddingTop: insets.top }}>
        <AuroraBackground />
        <Ionicons name="lock-closed-outline" size={64} color="rgba(255,255,255,0.2)" />
        <Text className="text-white text-2xl font-bold mt-6 text-center">Photo Access Required</Text>
        <Text className="text-white/50 text-base mt-3 text-center leading-6">
          Swipe Photos needs access to your library to help you review and clean up photos.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          className="mt-8 bg-white/15 rounded-full px-8 py-4"
        >
          <Text className="text-white font-semibold text-base">Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-end justify-between mb-4">
          <View>
            <Text className="text-white/50 text-sm font-medium">{dateLine}</Text>
            <Text
              className="text-white text-[34px] font-extrabold mt-0.5"
              style={{ letterSpacing: -0.8 }}
            >
              Your Library
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <SessionsChip />
            <StreakChip />
          </View>
        </View>

        {/* Limited access banner */}
        {isMediaLimited && (
          <Pressable
            onPress={() => Linking.openSettings()}
            className="flex-row items-center gap-3 rounded-2xl px-4 py-3 mb-3"
            style={{ backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.25)' }}
          >
            <Ionicons name="warning-outline" size={20} color="rgba(255,159,10,0.9)" />
            <View className="flex-1">
              <Text className="text-streak text-sm font-semibold">Limited photo access</Text>
              <Text className="text-streak/70 text-xs mt-0.5">
                You've granted access to {index.length.toLocaleString()} photos. Tap to expand in Settings.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,159,10,0.4)" />
          </Pressable>
        )}

        {/* Hero storage card */}
        <StorageSummary />

        {/* Week strip */}
        <StreakWidget />

        {/* Category tiles */}
        <View className="flex-row items-baseline justify-between mb-3">
          <Text className="text-white text-[19px] font-bold" style={{ letterSpacing: -0.3 }}>
            Review
          </Text>
          <Text className="text-white/40 text-[13px] font-medium">Pick a stack</Text>
        </View>
        <View className="flex-row flex-wrap gap-3 mb-3">
          {tiles.map((tile) => {
            const count = countFor(tile.id);
            return (
              <CategoryTile
                key={tile.id}
                label={tile.label}
                subtitle={subtitleFor(tile.id)}
                icon={tile.icon}
                count={count}
                coverUri={covers[tile.id as keyof typeof covers]}
                width={TILE_WIDTH}
                disabled={!isIndexing && count === 0}
                loading={isIndexing && count === 0}
                onPress={() => handleCategoryPress(tile.id)}
              />
            );
          })}
        </View>

        {/* Browse by month */}
        <Pressable onPress={() => router.navigate('/(tabs)/by-month')} className="active:opacity-70">
          <GlassCard radius={24}>
            <View className="p-4 flex-row items-center gap-3.5">
              <IconSquircle
                icon="calendar-number-outline"
                colors={GRADIENTS.accent}
                size={46}
                radius={15}
                iconSize={22}
                style={{
                  shadowColor: '#0A84FF',
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 8 },
                }}
              />
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Browse by month</Text>
                <Text className="text-white/45 text-[13px] mt-px">
                  {monthMeta.count > 0
                    ? `${monthMeta.count} months${monthMeta.oldestLabel ? ` · oldest ${monthMeta.oldestLabel}` : ''}`
                    : 'Browse photos month by month'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </View>
          </GlassCard>
        </Pressable>
      </ScrollView>
    </View>
  );
}
