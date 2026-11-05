import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { StatusBarScrim } from '@/components/glass/StatusBarScrim';
import { GlassCard } from '@/components/glass/GlassCard';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { IconSquircle } from '@/components/ui/IconSquircle';
import { SessionsMeter } from '@/components/ui/SessionsMeter';
import { StorageSummary } from '@/components/ui/StorageSummary';
import { StreakChip } from '@/components/ui/StreakChip';
import { AVG_VIDEO_SIZE_BYTES } from '@/constants/config';
import { GRADIENTS, SCREEN } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { formatBytes } from '@/lib/dateUtils';
import { getOnThisDay, getScreenshots, getVideos } from '@/lib/gallery/grouper';
import { effectiveBatchSize } from '@/lib/planUtils';
import { posthog } from '@/lib/posthog';
import { gateSessionStart } from '@/lib/sessionGate';
import { filterGroupsForReview } from '@/lib/similar/filterGroups';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { usePlanStore } from '@/stores/planStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSimilarStore } from '@/stores/similarStore';
import type { Category } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { mediaStatus, requestMedia, isMediaGranted, isMediaLimited } = usePermissions();

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

  // Counts + cover photos per category — one pass per index change
  const { counts, covers, videoBytes } = useMemo(() => {
    const onThisDay = getOnThisDay(index);
    const screenshots = getScreenshots(index);
    const videos = getVideos(index);
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

  const monthDay = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  // Similar-photos card (same filter the Similar tab uses, so the counts match)
  const similarGroups = useSimilarStore((s) => s.groups);
  const similarBestIds = useSimilarStore((s) => s.bestIds);
  const similarScanning = useSimilarStore((s) => s.scanState === 'scanning');
  const similarScannedAt = useSimilarStore((s) => s.scannedAt);
  const similarMeta = useMemo(() => {
    const indexIds = new Set(index.map((a) => a.id));
    const assetById = new Map(index.map((a) => [a.id, a]));
    const groups = filterGroupsForReview(similarGroups, keepIds, indexIds);
    const reclaimBytes = groups.reduce((sum, memberIds) => {
      const best =
        memberIds.find((id) => similarBestIds.has(id)) ?? memberIds[memberIds.length - 1];
      return (
        sum +
        memberIds
          .filter((id) => id !== best)
          .reduce((s, id) => {
            const asset = assetById.get(id);
            return s + (asset ? estimateSizeFromAsset(asset) : 0);
          }, 0)
      );
    }, 0);
    return { groupCount: groups.length, reclaimBytes };
  }, [similarGroups, similarBestIds, keepIds, index]);
  // The scan runs when the Similar tab is first opened, so a fresh install
  // describes the feature instead of showing "0 groups"
  const similarSubtitle =
    similarMeta.groupCount > 0
      ? `${similarMeta.groupCount} groups · ${formatBytes(similarMeta.reclaimBytes, 0)} to free`
      : similarScanning
        ? 'Finding look-alike shots…'
        : similarScannedAt === 0
          ? 'Group look-alike shots, keep the best'
          : 'No look-alike shots right now';

  const libraryEmpty = !isIndexing && index.length === 0;

  // Data-driven tile subtitles, per the design mock
  function subtitleFor(id: Category): string {
    switch (id) {
      case 'on-this-day':
        return `Memories from ${monthDay}`;
      case 'screenshots':
        return `${Math.round((categoryProgress.screenshots ?? 0) * 100)}% reviewed`;
      case 'videos':
        return `${formatBytes(videoBytes, 0)} total`;
      default:
        return 'Quick 5-min session';
    }
  }

  // Permission status still loading — render the backdrop only, so the locked
  // state below doesn't flash on every cold start
  if (!mediaStatus) {
    return (
      <View className="flex-1 bg-bg-dark">
        <AuroraBackground />
      </View>
    );
  }

  // No access yet. If iOS can still ask, "Continue" leads straight to the
  // system prompt (never "Allow" — Guideline 5.1.1(iv)); otherwise only
  // Settings can grant it.
  if (!isMediaGranted) {
    const canAsk = mediaStatus.canAskAgain;
    return (
      <View className="flex-1 bg-bg-dark items-center justify-center px-8" style={{ paddingTop: insets.top }}>
        <AuroraBackground />
        <Ionicons name="images-outline" size={64} color="rgba(255,255,255,0.25)" />
        <Text className="text-white text-2xl font-bold mt-6 text-center">Photo Access Needed</Text>
        <Text className="text-white/60 text-base mt-3 text-center leading-6">
          {canAsk
            ? 'Swipe Photos shows your photos one at a time so you can keep or delete them. Your photos never leave your iPhone.'
            : 'Photo access is turned off. To review your photos, allow access for Swipe Photos in Settings › Privacy & Security › Photos.'}
        </Text>
        <Pressable
          onPress={() => (canAsk ? requestMedia() : Linking.openSettings())}
          accessibilityRole="button"
          className="mt-8 bg-white/15 rounded-full px-8 min-h-[50px] items-center justify-center active:opacity-70"
        >
          <Text className="text-white font-semibold text-base">{canAsk ? 'Continue' : 'Open Settings'}</Text>
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
          paddingTop: insets.top + 4,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — streak chip + Settings (no longer a tab); sessions get their own slot below */}
        <View className="flex-row items-end justify-between mb-3">
          <Text
            className="text-white text-[34px] font-extrabold"
            style={{ letterSpacing: -0.8 }}
          >
            Swipe Photos
          </Text>
          <View className="flex-row items-center gap-2">
            <StreakChip />
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={4}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.14] active:opacity-70"
            >
              <Ionicons name="settings-sharp" size={19} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Free-plan sessions fuel gauge (renders null for Pro) */}
        <SessionsMeter />

        {/* Limited access banner */}
        {isMediaLimited && (
          <Pressable
            onPress={() => MediaLibrary.presentPermissionsPickerAsync().catch(() => Linking.openSettings())}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl px-4 py-3 mb-3"
            style={{ backgroundColor: 'rgba(255,159,10,0.12)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.25)' }}
          >
            <Ionicons name="warning-outline" size={20} color="rgba(255,159,10,0.9)" />
            <View className="flex-1">
              <Text className="text-streak text-sm font-semibold">Limited photo access</Text>
              <Text className="text-streak/70 text-xs mt-0.5">
                Swipe Photos can see {index.length.toLocaleString()} of your photos. Tap to choose more.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,159,10,0.4)" />
          </Pressable>
        )}

        {/* Hero storage card — the week streak strip now lives in its footer */}
        <StorageSummary />

        {libraryEmpty ? (
          // Empty (or nothing selected under Limited Access) — say how to get
          // started instead of a grid of zeros. Review devices often start empty.
          <GlassCard radius={24}>
            <View className="items-center px-6 py-7">
              <IconSquircle
                icon={isMediaLimited ? 'images-outline' : 'camera-outline'}
                colors={GRADIENTS.accent}
                size={52}
                radius={17}
                iconSize={26}
              />
              <Text className="text-white text-lg font-bold mt-4">
                {isMediaLimited ? 'No photos selected' : 'No photos yet'}
              </Text>
              <Text className="text-white/60 text-sm text-center mt-1.5" style={{ lineHeight: 20 }}>
                {isMediaLimited
                  ? 'Tap the banner above to choose which photos Swipe Photos can see.'
                  : 'Photos you take with the Camera show up here. Take 3 or 4 shots of the same scene to see Similar group them.'}
              </Text>
            </View>
          </GlassCard>
        ) : (
          <>
            {/* Similar photos — what sets the app apart, one tap from Home */}
            <Pressable
              onPress={() => router.navigate('/(tabs)/similar')}
              accessibilityRole="button"
              accessibilityLabel={`Similar photos. ${similarSubtitle}`}
              className="mb-5 active:opacity-70"
            >
              <GlassCard radius={24}>
                <View className="flex-row items-center gap-3 p-3.5">
                  <IconSquircle
                    icon="copy-outline"
                    colors={GRADIENTS.freed}
                    size={40}
                    radius={13}
                    iconSize={20}
                    style={{
                      shadowColor: '#30D158',
                      shadowOpacity: 0.3,
                      shadowRadius: 20,
                      shadowOffset: { width: 0, height: 8 },
                    }}
                  />
                  <View className="flex-1">
                    <Text className="text-white font-bold text-[15px]">Similar photos</Text>
                    <Text className="text-white/55 text-[12px] mt-px">{similarSubtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
                </View>
              </GlassCard>
            </Pressable>

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
          </>
        )}
      </ScrollView>
      <StatusBarScrim />
    </View>
  );
}
