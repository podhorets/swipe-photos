import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { StatusBarScrim } from '@/components/glass/StatusBarScrim';
import { GlassCard } from '@/components/glass/GlassCard';
import { ShortcutTile } from '@/components/home/ShortcutTile';
import { StackCard } from '@/components/home/StackCard';
import { IconSquircle } from '@/components/ui/IconSquircle';
import { SessionsMeter } from '@/components/ui/SessionsMeter';
import { StorageSummary } from '@/components/ui/StorageSummary';
import { StreakChip } from '@/components/ui/StreakChip';
import { GRADIENTS, SCREEN } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { formatBytes } from '@/lib/dateUtils';
import { buildPlaceStories } from '@/lib/feed/stories';
import { getOnThisDay } from '@/lib/gallery/grouper';
import { effectiveBatchSize } from '@/lib/planUtils';
import { startCategoryReview } from '@/lib/session/startCategoryReview';
import { filterGroupsForReview } from '@/lib/similar/filterGroups';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { useFeedStore } from '@/stores/feedStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { usePlacesStore } from '@/stores/placesStore';
import { usePlanStore } from '@/stores/planStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSimilarStore } from '@/stores/similarStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TILE_WIDTH = (SCREEN.width - 40 - 12) / 2; // px-5 screen padding, gap-3


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

  const liked = useFeedStore((s) => s.liked);
  const trashed = useFeedStore((s) => s.trashed);
  const locations = usePlacesStore((s) => s.locations);

  // Photo GPS for the "By location" count — read on the device; the store skips photos already checked
  useEffect(() => {
    if (index.length > 0) usePlacesStore.getState().scan(index.map((a) => a.id));
  }, [index]);

  const onThisDay = useMemo(() => getOnThisDay(index), [index]);
  const onThisDayProgress = useMemo(
    () => (onThisDay.length > 0 ? onThisDay.filter((a) => keepIds.has(a.id)).length / onThisDay.length : 0),
    [onThisDay, keepIds],
  );
  // "4 photos from 2025, 2023 and 2021" — newest year first, at most three named
  const onThisDaySubtitle = useMemo(() => {
    const years = [...new Set(onThisDay.map((a) => new Date(a.creationTime).getFullYear()))].sort((a, b) => b - a);
    const photos = `${onThisDay.length} ${onThisDay.length === 1 ? 'photo' : 'photos'}`;
    if (years.length === 0) return photos;
    const named = years.slice(0, 3);
    const rest = years.length - named.length;
    const list =
      rest > 0
        ? `${named.join(', ')} and ${rest} more ${rest === 1 ? 'year' : 'years'}`
        : named.length === 1
          ? String(named[0])
          : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    return `${photos} from ${list}`;
  }, [onThisDay]);

  const { yearCount, monthCount } = useMemo(() => {
    const months = new Set(index.map((a) => {
      const d = new Date(a.creationTime);
      return d.getFullYear() * 12 + d.getMonth();
    }));
    const years = new Set([...months].map((m) => Math.floor(m / 12)));
    return { yearCount: years.size, monthCount: months.size };
  }, [index]);

  const placeCount = useMemo(() => {
    const reviewed = new Set<string>([...keepIds, ...liked, ...trashed]);
    return buildPlaceStories(index, locations, 3, reviewed).length;
  }, [index, locations, keepIds, liked, trashed]);

  const randomLabel = `Random ${displayBatchSize}`;

  function startOnThisDay() {
    startCategoryReview('on-this-day', {
      label: 'On This Day',
      count: onThisDay.length,
      progress: onThisDayProgress,
      indexing: isIndexing,
    });
  }

  function startRandom() {
    startCategoryReview('random', { label: randomLabel, count: index.length, indexing: isIndexing });
  }

  // Library opens on the chosen view; `at` makes a repeat tap re-apply it
  function openLibrary(view: 'Months' | 'Types') {
    router.navigate({ pathname: '/(tabs)/by-month', params: { view, at: String(Date.now()) } });
  }

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
      ? `${similarMeta.groupCount} groups · ${formatBytes(similarMeta.reclaimBytes, 0)}`
      : similarScanning
        ? 'Finding look-alikes…'
        : similarScannedAt === 0
          ? 'Keep the best shot'
          : 'None right now';

  const libraryEmpty = !isIndexing && index.length === 0;

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
            {/* Today's memories, then a random stack — each starts a session */}
            {onThisDay.length > 0 && (
              <StackCard
                title="On This Day"
                subtitle={onThisDaySubtitle}
                icon="sparkles"
                badge="Today"
                coverUri={onThisDay[0]?.uri}
                height={156}
                onStart={startOnThisDay}
                onPress={() => router.push('/on-this-day')}
              />
            )}
            <StackCard
              title={randomLabel}
              subtitle={`Quick 5-min session · ${index.length.toLocaleString()} items`}
              icon="shuffle"
              coverUri={index[0]?.uri}
              height={112}
              onStart={startRandom}
            />

            {/* Shortcuts to the other tabs and Library views */}
            <View className="flex-row flex-wrap gap-3 mt-1 mb-3">
              <ShortcutTile
                label="Feed"
                subtitle="Scroll and decide"
                icon="albums"
                colors={GRADIENTS.accent}
                width={TILE_WIDTH}
                onPress={() => router.navigate('/(tabs)/feed')}
              />
              <ShortcutTile
                label="Similar"
                subtitle={similarSubtitle}
                icon="copy-outline"
                colors={GRADIENTS.freed}
                width={TILE_WIDTH}
                onPress={() => router.navigate('/(tabs)/similar')}
              />
              <ShortcutTile
                label="By Year"
                subtitle={`${yearCount} ${yearCount === 1 ? 'year' : 'years'} · ${monthCount} months`}
                icon="calendar-number"
                colors={GRADIENTS.notify}
                width={TILE_WIDTH}
                onPress={() => openLibrary('Months')}
              />
              <ShortcutTile
                label="By Location"
                subtitle={placeCount > 0 ? `${placeCount} ${placeCount === 1 ? 'place' : 'places'}` : 'Trips from your photos'}
                icon="location"
                colors={GRADIENTS.shield}
                width={TILE_WIDTH}
                onPress={() => openLibrary('Types')}
              />
            </View>
          </>
        )}
      </ScrollView>
      <StatusBarScrim />
    </View>
  );
}
