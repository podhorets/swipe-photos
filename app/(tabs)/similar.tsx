import { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, type ListRenderItemInfo } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { PhotoChip } from '@/components/ui/PhotoChip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StatusBarScrim } from '@/components/ui/StatusBarScrim';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { useSimilarStore } from '@/stores/similarStore';
import { usePlanStore } from '@/stores/planStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { filterGroupsForReview } from '@/lib/similar/filterGroups';
import { effectiveBatchSize } from '@/lib/planUtils';
import { gateSessionStart } from '@/lib/sessionGate';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { formatBytes } from '@/lib/dateUtils';
import { SIMILAR } from '@/constants/config';
import { SCREEN } from '@/constants/theme';
import { ProgressivePhoto } from '@/components/similar/ProgressivePhoto';
import { posthog } from '@/lib/posthog';
import type { AssetMeta } from '@/types';

interface DisplayGroup {
  key: string;
  memberIds: string[];
  /** Best photo first, then up to 3 more members — feeds the collage tile. */
  previewUris: string[];
  reclaimBytes: number;
}

// Groups added to the grid per page as the user scrolls. The header totals and
// the review CTA always cover every group; only the collages are paged.
const PAGE_SIZE = 20;

// Share of the scan dial owned by the compare pass; the rest is best-shot analysis
const COMPARE_SHARE = 0.85;

// Two collage tiles per row (18pt screen padding, 14pt column gap), 170pt high
const SCREEN_X = 18;
const COLUMN_GAP = 14;
const TILE_SIZE = (SCREEN.width - SCREEN_X * 2 - COLUMN_GAP) / 2;
const TILE_HEIGHT = 170;
const CELL_GAP = 2;

/**
 * Square photo collage for one duplicate group: 2 members = side-by-side
 * halves, 3 = best takes the left half, 4+ = 2×2 grid with a "+N" overlay on
 * the last cell. The best photo is always first and carries a star badge.
 */
function GroupCollage({ uris, memberCount }: { uris: string[]; memberCount: number }) {
  const t = useTheme();
  const half = (TILE_SIZE - CELL_GAP) / 2;
  const halfH = (TILE_HEIGHT - CELL_GAP) / 2;
  const cells: { uri: string; left: number; top: number; w: number; h: number }[] = [];

  if (uris.length <= 1) {
    if (uris[0]) cells.push({ uri: uris[0], left: 0, top: 0, w: TILE_SIZE, h: TILE_HEIGHT });
  } else if (uris.length === 2) {
    cells.push({ uri: uris[0], left: 0, top: 0, w: half, h: TILE_HEIGHT });
    cells.push({ uri: uris[1], left: half + CELL_GAP, top: 0, w: half, h: TILE_HEIGHT });
  } else if (uris.length === 3) {
    cells.push({ uri: uris[0], left: 0, top: 0, w: half, h: TILE_HEIGHT });
    cells.push({ uri: uris[1], left: half + CELL_GAP, top: 0, w: half, h: halfH });
    cells.push({ uri: uris[2], left: half + CELL_GAP, top: halfH + CELL_GAP, w: half, h: halfH });
  } else {
    cells.push({ uri: uris[0], left: 0, top: 0, w: half, h: halfH });
    cells.push({ uri: uris[1], left: half + CELL_GAP, top: 0, w: half, h: halfH });
    cells.push({ uri: uris[2], left: 0, top: halfH + CELL_GAP, w: half, h: halfH });
    cells.push({ uri: uris[3], left: half + CELL_GAP, top: halfH + CELL_GAP, w: half, h: halfH });
  }

  const overflow = memberCount - cells.length;

  return (
    <View
      className="rounded-[20px] overflow-hidden bg-track"
      style={{ width: TILE_SIZE, height: TILE_HEIGHT, boxShadow: t.shadow.card }}
    >
      {cells.map((cell, i) => (
        <View
          key={cell.uri}
          style={{ position: 'absolute', left: cell.left, top: cell.top, width: cell.w, height: cell.h }}
        >
          <ProgressivePhoto uri={cell.uri} width={cell.w} height={cell.h} />
          {/* "+N" overlay on the last cell when the group is bigger than the tile */}
          {i === cells.length - 1 && overflow > 0 && (
            <View className="absolute inset-0 bg-chip items-center justify-center">
              <Text className="font-display text-chip-fg text-[20px]">+{overflow}</Text>
            </View>
          )}
        </View>
      ))}
      {/* Best badge on the first (best) cell */}
      <View className="absolute top-2 left-2">
        <PhotoChip label="Best" star small />
      </View>
    </View>
  );
}

/** One grid cell. Memoized so paging and scan-progress ticks skip loaded tiles. */
const GroupTile = memo(function GroupTile({
  group,
  onPress,
}: {
  group: DisplayGroup;
  onPress: (groupKey: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(group.key)}
      accessibilityRole="button"
      className="mb-3 active:opacity-80"
    >
      <GroupCollage uris={group.previewUris} memberCount={group.memberIds.length} />
      <View className="flex-row items-baseline justify-between mt-1.5 px-0.5">
        <Text className="text-fg text-[15px] font-bold">{group.memberIds.length} photos</Text>
        <Text className="text-fg-2 text-[13px]">{formatBytes(group.reclaimBytes)}</Text>
      </View>
    </Pressable>
  );
});

export default function SimilarScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const isIndexing = useGalleryStore((s) => s.isIndexing);
  const keepIds = useKeepStore((s) => s.keepIds);
  const groups = useSimilarStore((s) => s.groups);
  const bestIds = useSimilarStore((s) => s.bestIds);
  const scanState = useSimilarStore((s) => s.scanState);
  const scanProgress = useSimilarStore((s) => s.scanProgress);
  const scannedAt = useSimilarStore((s) => s.scannedAt);
  const analyzerUsed = useSimilarStore((s) => s.analyzerUsed);
  const planState = usePlanStore();
  const batchSize = useSettingsStore((s) => s.batchSize);

  // Rescan when the tab gains focus and results are missing, stale, or the
  // library has newer photos than the last scan saw. Deletions never trigger
  // a rescan — read-time filtering handles them.
  //
  // IMPORTANT: scannedAt/scannedNewest are read imperatively, NOT effect deps.
  // The scan writes them, so depending on them re-runs this effect after every
  // scan — one bad staleness rule away from an infinite scan loop that pins
  // the JS thread (found the hard way).
  useFocusEffect(
    useCallback(() => {
      if (isIndexing || index.length === 0) return;
      const { scannedAt: at, scannedNewestCreationTime: seen, scanState: state } =
        useSimilarStore.getState();
      if (state === 'scanning') return;
      const newest = index.reduce((max, a) => Math.max(max, a.creationTime), 0);
      const stale =
        at === 0 || Date.now() - at > SIMILAR.rescanMaxAgeMs || newest > seen;
      if (stale) {
        useSimilarStore
          .getState()
          .runScan()
          .then(() => {
            const s = useSimilarStore.getState();
            posthog.capture('similar_scan_completed', {
              group_count: s.groups.length,
              photo_count: s.groups.reduce((n, g) => n + g.length, 0),
              analyzer_available: s.analyzerUsed,
            });
          });
      }
    }, [isIndexing, index]),
  );

  const assetById = useMemo(() => {
    const map = new Map<string, AssetMeta>();
    for (const a of index) map.set(a.id, a);
    return map;
  }, [index]);

  // Same filter the session factory uses — displayed counts match session content
  const displayGroups = useMemo<DisplayGroup[]>(() => {
    const indexIds = new Set(index.map((a) => a.id));
    return filterGroupsForReview(groups, keepIds, indexIds).map((memberIds) => {
      const best =
        memberIds.find((id) => bestIds.has(id)) ?? memberIds[memberIds.length - 1];
      const reclaimBytes = memberIds
        .filter((id) => id !== best)
        .reduce((sum, id) => {
          const asset = assetById.get(id);
          return sum + (asset ? estimateSizeFromAsset(asset) : 0);
        }, 0);
      const previewUris = [best, ...memberIds.filter((id) => id !== best)]
        .slice(0, 4)
        .map((id) => assetById.get(id)?.uri)
        .filter((uri): uri is string => !!uri);
      return {
        key: memberIds[0],
        memberIds,
        previewUris,
        reclaimBytes,
      };
    });
  }, [groups, keepIds, index, bestIds, assetById]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleGroups = useMemo(
    () => displayGroups.slice(0, visibleCount),
    [displayGroups, visibleCount],
  );
  const loadMoreGroups = useCallback(() => {
    setVisibleCount((n) => (n < displayGroups.length ? n + PAGE_SIZE : n));
  }, [displayGroups.length]);

  const totalPhotos = displayGroups.reduce((n, g) => n + g.memberIds.length, 0);
  const totalReclaim = displayGroups.reduce((n, g) => n + g.reclaimBytes, 0);
  const reviewCount = Math.min(
    displayGroups.length,
    effectiveBatchSize(planState, batchSize),
  );

  const handleStartReview = useCallback(
    (startGroupKey?: string) => {
      if (!gateSessionStart()) return;
      posthog.capture('similar_review_started', {
        group_count: reviewCount,
        from_tile: !!startGroupKey,
      });
      router.push(
        startGroupKey
          ? {
              pathname: '/review/[sessionId]',
              params: { sessionId: 'similar', startGroup: startGroupKey },
            }
          : '/review/similar',
      );
    },
    [reviewCount],
  );

  const renderGroup = useCallback(
    ({ item }: ListRenderItemInfo<DisplayGroup>) => (
      <GroupTile group={item} onPress={handleStartReview} />
    ),
    [handleStartReview],
  );

  const scanning = scanState === 'scanning';
  // The two passes each report 0→100% of their own workload, so a raw ratio
  // would fill the dial and snap back to zero when best-shot picking starts.
  // Fold them into one monotonic number: compare walks the whole library,
  // analyze only the groups it found, so compare owns most of the sweep.
  const phaseRatio =
    scanProgress && scanProgress.total > 0 ? scanProgress.processed / scanProgress.total : 0;
  const scanRatio =
    scanProgress?.phase === 'analyze'
      ? COMPARE_SHARE + phaseRatio * (1 - COMPARE_SHARE)
      : phaseRatio * COMPARE_SHARE;
  const scanPct = Math.round(scanRatio * 100);

  const fadeBottom = t.background.colors[t.background.colors.length - 1];
  // Top edge of the floating tab bar (FloatingTabBar: bottom offset + 56pt)
  const tabBarTop = Math.max(insets.bottom - 4, 26) + 56;
  const notes = scanning
    ? 'Scan running — reviewing already-found groups'
    : !analyzerUsed && scannedAt > 0
      ? 'Grouped by when photos were taken'
      : null;

  return (
    <View className="flex-1">
      <ScreenBackground />

      <View className="flex-1" style={{ paddingTop: insets.top + 12, paddingHorizontal: SCREEN_X }}>
        <View className="flex-row items-start justify-between gap-3 mb-4">
          <View className="flex-1">
            <Text className="font-display text-fg text-[34px] leading-[37px]">Similar</Text>
            <Text className="text-fg-2 text-[14px] mt-[3px]">
              {displayGroups.length > 0
                ? `${displayGroups.length} groups · ${totalPhotos} photos · ${formatBytes(totalReclaim)} to free`
                : scanning
                  ? 'Finding lookalike shots…'
                  : 'Near-duplicate photos, grouped for quick cleanup'}
            </Text>
          </View>

          {/* Scan progress — a corner dial rather than a banner. The scan is
              informational (the list and CTA stay usable on the previous
              scan's groups), so it shouldn't cost a row of the layout. */}
          {scanning && (
            <View
              className="mt-1.5"
              accessibilityRole="progressbar"
              accessibilityLabel={`Scanning for similar photos, ${scanPct}% complete`}
            >
              <ProgressRing size={48} radius={19.5} strokeWidth={4} progress={scanRatio} duration={450}>
                <Text className="text-fg text-[11px] font-extrabold">{scanPct}%</Text>
              </ProgressRing>
            </View>
          )}
        </View>

        {/* Group previews / empty state */}
        {displayGroups.length === 0 ? (
          scanning ? (
            <Text className="text-fg-2 text-[13px] text-center mt-6">
              First groups will appear here in a moment — you can start reviewing
              while the scan keeps running.
            </Text>
          ) : (
            <View className="flex-1 items-center justify-center pb-40">
              {/* An empty library never gets scanned (scannedAt stays 0) —
                  don't promise a scan that will never come */}
              <EmptyState
                icon="similarTile"
                color="teal"
                title={
                  !isIndexing && index.length === 0
                    ? 'No photos yet'
                    : isIndexing || scannedAt === 0
                      ? 'Getting ready…'
                      : 'No similar photos'
                }
                body={
                  !isIndexing && index.length === 0
                    ? 'Look-alike shots from your library will show up here.'
                    : isIndexing || scannedAt === 0
                      ? 'Your library is being scanned for lookalike shots.'
                      : 'Nice — no near-duplicates left in your library.'
                }
              />
            </View>
          )
        ) : (
          <FlatList
            data={visibleGroups}
            keyExtractor={(g) => g.key}
            numColumns={2}
            columnWrapperStyle={{ gap: COLUMN_GAP }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 190 }}
            // Counts are rows (numColumns=2). Each collage is up to 8 image
            // decodes, and the defaults (10 rows up front, ±10 screens kept)
            // mounted every group at once; keep about ±2 screens instead.
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            onEndReached={loadMoreGroups}
            onEndReachedThreshold={1}
            renderItem={renderGroup}
          />
        )}
      </View>

      {/* Sticky CTA — available whenever loaded groups exist, including during
          a rescan (the session snapshots its groups at start, so a scan
          finishing mid-review can't affect it). The grid fades into the
          background behind it; notes sit above the button. */}
      {displayGroups.length > 0 && (
        <View
          className="absolute left-0 right-0 bottom-0"
          // Only the button takes touches; drags on the fade scroll the grid
          pointerEvents="box-none"
        >
          <LinearGradient
            pointerEvents="none"
            colors={[`${fadeBottom}00`, fadeBottom]}
            locations={[0, 0.45]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: tabBarTop + 112 }}
          />
          <View
            className="mx-[18px]"
            style={{ marginBottom: tabBarTop + 12 }}
            pointerEvents="box-none"
          >
            {notes && (
              <View
                className="self-center rounded-full bg-card border border-hairline px-3 min-h-[26px] justify-center mb-2"
                pointerEvents="none"
              >
                <Text className="text-fg-2 text-[12px] font-semibold text-center">{notes}</Text>
              </View>
            )}
            <PrimaryButton
              label={`Review ${reviewCount} group${reviewCount === 1 ? '' : 's'}`}
              icon="sparkle"
              floating
              onPress={() => handleStartReview()}
            />
          </View>
        </View>
      )}
      <StatusBarScrim />
    </View>
  );
}
