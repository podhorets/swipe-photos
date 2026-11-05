import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSessionStore } from '@/stores/sessionStore';
import { useFeedStore } from '@/stores/feedStore';
import { useKeepStore } from '@/stores/keepStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useStreakStore } from '@/stores/streakStore';
import { usePlanStore } from '@/stores/planStore';
import { useStatsStore } from '@/stores/statsStore';
import { SessionComplete } from '@/components/ui/SessionComplete';
import { Card } from '@/components/ui/Card';
import { BackCircle } from '@/components/ui/CircleButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { formatBytes } from '@/lib/dateUtils';
import type { AssetMeta, SwipeDecision } from '@/types';
import { posthog } from '@/lib/posthog';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_X = 21;
const GRID_GAP = 10;
const CELL_SIZE = (SCREEN_WIDTH - SCREEN_X * 2 - GRID_GAP * 2) / 3; // 3 columns
const CELL_HEIGHT = 110;

// ─── Photo cell ───────────────────────────────────────────────────────────────

function PhotoCell({
  asset,
  selected,
  onToggle,
}: {
  asset: AssetMeta;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? 'Marked for deletion — tap to keep' : 'Kept — tap to delete'}
      className={`rounded-[13px] overflow-hidden bg-track ${selected ? 'border-[2.5px] border-del-ring' : 'border border-hairline'}`}
      style={{ width: CELL_SIZE, height: CELL_HEIGHT }}
    >
      <Image
        source={{ uri: asset.uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        recyclingKey={asset.id}
      />
      {/* Deselected — kept overlay */}
      {!selected && (
        <>
          <View className="absolute inset-0 bg-card" style={{ opacity: 0.72 }} />
          <View className="absolute inset-0 items-center justify-center">
            <View className="flex-row items-center gap-1 px-[9px] py-1 rounded-full bg-keep-tint border border-keep-ring">
              <Icon name="heart" size={11} color={t.keep.icon} fill={t.keep.icon} />
              <Text className="text-keep-text text-[11px] font-bold">Kept</Text>
            </View>
          </View>
        </>
      )}
      {/* Selected — red check badge */}
      {selected && (
        <View className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-del-fill items-center justify-center">
          <Icon name="check" size={11} color={t.text.onButton} strokeWidth={3.4} />
        </View>
      )}
      {/* Video badge */}
      {asset.mediaType === 'video' && (
        <View className="absolute bottom-1.5 left-1.5 bg-chip rounded-full w-5 h-5 items-center justify-center">
          <Icon name="play" size={10} color={t.photoChip.text} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTrash() {
  return (
    <View className="flex-1 items-center justify-center pb-20">
      <EmptyState
        icon="trash"
        color="rose"
        title="No photos marked for deletion"
        action={{ label: 'Go back', onPress: () => router.back() }}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrashScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const index = useGalleryStore((s) => s.index);
  const removeAssets = useGalleryStore((s) => s.removeAssets);
  const faceIdEnabled = useSettingsStore((s) => s.faceIdEnabled);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStats, setSummaryStats] = useState({ total: 0, kept: 0, freedBytes: 0 });

  // Opened from the Feed's trash icon: review the feed's disliked photos
  // instead of a session's (Feed POC)
  const { source } = useLocalSearchParams<{ source?: string }>();
  const fromFeed = source === 'feed';

  // Get delete decisions from the current session (session-scoped trash).
  // Captured once on mount — session decisions don't change while we're in trash.
  const [sessionDecisions] = useState<Record<string, SwipeDecision>>(() =>
    fromFeed
      ? Object.fromEntries(useFeedStore.getState().trashed.map((id) => [id, 'delete' as const]))
      : useSessionStore.getState().decisions,
  );
  const [sessionSizeSnapshot] = useState(() => useSessionStore.getState().sizeSnapshot);
  const deleteIds = useMemo(
    () => Object.entries(sessionDecisions)
      .filter(([, d]) => d === 'delete')
      .map(([id]) => id),
    [sessionDecisions],
  );

  // Resolve delete IDs → AssetMeta (skip any no longer in index)
  const deleteAssets = useMemo(() => {
    const byId = new Map<string, AssetMeta>(index.map((a) => [a.id, a]));
    return deleteIds
      .map((id) => byId.get(id))
      .filter((a): a is AssetMeta => a !== undefined);
  }, [deleteIds, index]);

  // All delete assets are selected by default
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(deleteIds),
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allSelected = selected.size === deleteAssets.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deleteAssets.map((a) => a.id)));
    }
  }

  // Estimated bytes freed by the current selection — same math as handleDelete
  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const id of selected) {
      const real = sessionSizeSnapshot.get(id);
      const asset = deleteAssets.find((a) => a.id === id);
      sum += real ?? (asset ? estimateSizeFromAsset(asset) : 0);
    }
    return sum;
  }, [selected, deleteAssets, sessionSizeSnapshot]);

  async function handleDelete() {
    const idsToDelete = Array.from(selected);
    if (idsToDelete.length === 0) return;

    // Face ID gate
    if (faceIdEnabled) {
      const supported = await LocalAuthentication.hasHardwareAsync();
      if (supported) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Delete ${idsToDelete.length} photo${idsToDelete.length === 1 ? '' : 's'}`,
          fallbackLabel: 'Use Passcode',
          cancelLabel: 'Cancel',
        });
        if (!result.success) return;
      }
    }

    setIsDeleting(true);
    try {
      // deleteAssetsAsync shows a native iOS "Delete X Photos?" confirmation dialog.
      // performChanges is atomic: it rejects when the user taps "Don't Allow" (or
      // on any other failure) and nothing is deleted. Assets already deleted
      // externally don't reject — they're just absent from the fetch.
      await MediaLibrary.deleteAssetsAsync(idsToDelete);
    } catch (e) {
      setIsDeleting(false);
      // PHPhotosError.userCancelled (3072) — user changed their mind; stay in trash
      const message = e instanceof Error ? e.message : String(e);
      if (!/3072|cancel/i.test(message)) {
        Alert.alert('Couldn’t Delete Photos', 'Nothing was deleted. Please try again.');
      }
      return;
    }

    // Remove deleted assets from gallery index
    removeAssets(idsToDelete);

    // IDs that were deselected (user changed mind) + all 'keep' decisions from session
    const deselectedIds = deleteIds.filter((id) => !selected.has(id));

    if (fromFeed) {
      // Feed trash: deleted photos leave it, deselected ones go back to the feed.
      // Not a review session, so no keeps, streak or plan quota.
      useFeedStore.getState().removeFromTrash(deleteIds);
      setIsDeleting(false);
      const freed = idsToDelete.reduce((sum, id) => {
        const asset = deleteAssets.find((a) => a.id === id);
        return sum + (asset ? estimateSizeFromAsset(asset) : 0);
      }, 0);
      useStatsStore.getState().addFreedBytes(freed);
      useStatsStore.getState().addDeletedCount(idsToDelete.length);
      setSummaryStats({ total: deleteIds.length, kept: deselectedIds.length, freedBytes: freed });
      setShowSummary(true);
      return;
    }
    const sessionKeepIds = Object.entries(sessionDecisions)
      .filter(([, d]) => d === 'keep')
      .map(([id]) => id);
    const allKeptIds = [...deselectedIds, ...sessionKeepIds];
    if (allKeptIds.length > 0) {
      useKeepStore.getState().addMany(allKeptIds);
    }

    setIsDeleting(false);

    useStreakStore.getState().recordSession();
    // Free-plan quota: a session only counts once photos are actually cleaned
    // (or kept via the zero-deletion path in review/[sessionId].tsx). Discarding
    // the trash intentionally does not consume a session.
    usePlanStore.getState().recordCompletedSession();

    const freedBytes = idsToDelete.reduce((sum, id) => {
      const real = sessionSizeSnapshot.get(id);
      const asset = deleteAssets.find(a => a.id === id);
      return sum + (real ?? (asset ? estimateSizeFromAsset(asset) : 0));
    }, 0);

    useStatsStore.getState().addFreedBytes(freedBytes);
    useStatsStore.getState().addDeletedCount(idsToDelete.length);

    posthog.capture('photos_deleted', {
      deleted_count: idsToDelete.length,
      kept_count: allKeptIds.length,
      freed_bytes: freedBytes,
      face_id_used: faceIdEnabled,
    });

    // Show inline summary
    setSummaryStats({
      total: Object.keys(sessionDecisions).length,
      kept: allKeptIds.length,
      freedBytes,
    });
    setShowSummary(true);
  }

  const fadeBottom = t.background.colors[t.background.colors.length - 1];

  if (deleteAssets.length === 0 && !showSummary) {
    return (
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <ScreenBackground />
        <View className="flex-row items-center px-[18px] py-4 gap-2.5">
          <BackCircle />
          <Text className="font-display text-fg text-[22px]">Trash</Text>
        </View>
        <EmptyTrash />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScreenBackground />

      {/* Header */}
      <View className="flex-row items-start pl-[18px] pr-[21px] pb-3 gap-2.5" style={{ paddingTop: insets.top + 16 }}>
        <BackCircle className="mt-[3px]" />
        <View className="flex-1">
          <Text className="font-display text-fg text-[22px]">Trash</Text>
          <Text className="text-fg-2 text-[12.5px] leading-4 mt-0.5">
            Last check before deleting — tap to keep instead
          </Text>
        </View>
        <Pressable
          onPress={toggleSelectAll}
          accessibilityRole="button"
          className="min-h-[44px] justify-center active:opacity-60"
          hitSlop={12}
        >
          <Text className="text-link text-[13px] font-bold">
            {allSelected ? 'Deselect all' : 'Select all'}
          </Text>
        </Pressable>
      </View>

      {/* Photo grid */}
      <FlatList
        data={deleteAssets}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <PhotoCell
            asset={item}
            selected={selected.has(item.id)}
            onToggle={toggleSelect}
          />
        )}
        columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: SCREEN_X }}
        contentContainerStyle={{ gap: GRID_GAP, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating bottom bar over a fade into the background */}
      <View className="absolute bottom-0 left-0 right-0">
        <LinearGradient
          colors={[`${fadeBottom}00`, fadeBottom]}
          locations={[0, 0.4]}
          style={{ paddingTop: 16, paddingHorizontal: SCREEN_X, paddingBottom: insets.bottom + 12 }}
        >
          <Card floating className="flex-row items-center min-h-[65px] pl-4 pr-2.5 py-2.5 gap-3">
            <View className="flex-1">
              <Text className="text-fg text-[15.5px] font-bold">{selected.size} selected</Text>
              <Text className="text-fg-2 text-[11px] mt-px">
                {selected.size > 0
                  ? `About ${formatBytes(selectedBytes)} · recoverable for 30 days`
                  : 'Tap photos to select'}
              </Text>
            </View>
            <PrimaryButton
              label="Delete"
              variant="delete"
              compact
              icon={faceIdEnabled ? 'lock' : 'trashSmall'}
              onPress={handleDelete}
              disabled={selected.size === 0}
              loading={isDeleting}
            />
          </Card>
        </LinearGradient>
      </View>

      {/* Post-deletion summary overlay */}
      {showSummary && (
        <SessionComplete
          totalCount={summaryStats.total}
          keptCount={summaryStats.kept}
          freedBytes={summaryStats.freedBytes}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
