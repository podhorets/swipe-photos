import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
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
import { GRADIENTS, SCREEN } from '@/constants/theme';
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

// How many group cards the tab previews — the review session covers up to a
// full batch regardless, so the list is a teaser, not the full inventory.
const PREVIEW_GROUP_COUNT = 50;

// Share of the scan dial owned by the compare pass; the rest is best-shot analysis
const COMPARE_SHARE = 0.85;

// Two square collage tiles per row (px-5 screen padding, 12 gap)
const TILE_SIZE = (SCREEN.width - 40 - 12) / 2;
const CELL_GAP = 2;

/**
 * Square photo collage for one duplicate group: 2 members = side-by-side
 * halves, 3 = best takes the left half, 4+ = 2×2 grid with a "+N" overlay on
 * the last cell. The best photo is always first and carries a star badge.
 */
function GroupCollage({ uris, memberCount }: { uris: string[]; memberCount: number }) {
  const half = (TILE_SIZE - CELL_GAP) / 2;
  const cells: { uri: string; left: number; top: number; w: number; h: number }[] = [];

  if (uris.length <= 1) {
    if (uris[0]) cells.push({ uri: uris[0], left: 0, top: 0, w: TILE_SIZE, h: TILE_SIZE });
  } else if (uris.length === 2) {
    cells.push({ uri: uris[0], left: 0, top: 0, w: half, h: TILE_SIZE });
    cells.push({ uri: uris[1], left: half + CELL_GAP, top: 0, w: half, h: TILE_SIZE });
  } else if (uris.length === 3) {
    cells.push({ uri: uris[0], left: 0, top: 0, w: half, h: TILE_SIZE });
    cells.push({ uri: uris[1], left: half + CELL_GAP, top: 0, w: half, h: half });
    cells.push({ uri: uris[2], left: half + CELL_GAP, top: half + CELL_GAP, w: half, h: half });
  } else {
    cells.push({ uri: uris[0], left: 0, top: 0, w: half, h: half });
    cells.push({ uri: uris[1], left: half + CELL_GAP, top: 0, w: half, h: half });
    cells.push({ uri: uris[2], left: 0, top: half + CELL_GAP, w: half, h: half });
    cells.push({ uri: uris[3], left: half + CELL_GAP, top: half + CELL_GAP, w: half, h: half });
  }

  const overflow = memberCount - cells.length;

  return (
    <View
      className="rounded-2xl overflow-hidden bg-white/[0.06]"
      style={{ width: TILE_SIZE, height: TILE_SIZE }}
    >
      {cells.map((cell, i) => (
        <View
          key={cell.uri}
          style={{ position: 'absolute', left: cell.left, top: cell.top, width: cell.w, height: cell.h }}
        >
          <ProgressivePhoto uri={cell.uri} width={cell.w} height={cell.h} />
          {/* "+N" overlay on the last cell when the group is bigger than the tile */}
          {i === cells.length - 1 && overflow > 0 && (
            <View className="absolute inset-0 bg-black/60 items-center justify-center">
              <Text className="text-white text-[20px] font-extrabold">+{overflow}</Text>
            </View>
          )}
        </View>
      ))}
      {/* Best badge on the first (best) cell */}
      <View className="absolute top-1.5 left-1.5 flex-row items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60">
        <Ionicons name="star" size={9} color="#FFD60A" />
        <Text className="text-white text-[10px] font-bold">Best</Text>
      </View>
    </View>
  );
}

export default function SimilarScreen() {
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

  const previewGroups = useMemo(
    () => displayGroups.slice(0, PREVIEW_GROUP_COUNT),
    [displayGroups],
  );

  const totalPhotos = displayGroups.reduce((n, g) => n + g.memberIds.length, 0);
  const totalReclaim = displayGroups.reduce((n, g) => n + g.reclaimBytes, 0);
  const reviewCount = Math.min(
    displayGroups.length,
    effectiveBatchSize(planState, batchSize),
  );

  function handleStartReview(startGroupKey?: string) {
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
  }

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

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="by-month" />

      <View
        className="flex-1 px-5"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View className="flex-row items-start justify-between gap-3 mb-4">
          <View className="flex-1">
            <Text
              className="text-white text-[34px] font-extrabold mb-1"
              style={{ letterSpacing: -0.8 }}
            >
              Similar
            </Text>
            <Text className="text-white/50 text-sm">
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
              <ProgressRing
                size={48}
                radius={19.5}
                strokeWidth={4}
                progress={scanRatio}
                duration={450}
                gradientColors={GRADIENTS.freed}
              >
                <Text className="text-white text-[11px] font-extrabold">{scanPct}%</Text>
              </ProgressRing>
            </View>
          )}
        </View>

        {/* Group previews / empty state */}
        {displayGroups.length === 0 ? (
          scanning ? (
            <Text className="text-white/35 text-[13px] text-center mt-6">
              First groups will appear here in a moment — you can start reviewing
              while the scan keeps running.
            </Text>
          ) : (
            <View className="flex-1 items-center justify-center pb-40">
              <View className="w-20 h-20 rounded-full bg-white/[0.07] border border-white/[0.14] items-center justify-center mb-5">
                <Ionicons name="copy-outline" size={32} color="rgba(255,255,255,0.6)" />
              </View>
              <Text className="text-white text-lg font-bold mb-1.5">
                {isIndexing || scannedAt === 0 ? 'Getting ready…' : 'No similar photos'}
              </Text>
              <Text className="text-white/45 text-sm text-center px-10" style={{ lineHeight: 20 }}>
                {isIndexing || scannedAt === 0
                  ? 'Your library is being scanned for lookalike shots.'
                  : 'Nice — no near-duplicates left in your library.'}
              </Text>
            </View>
          )
        ) : (
          <FlatList
            data={previewGroups}
            keyExtractor={(g) => g.key}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 190 }}
            ListFooterComponent={
              displayGroups.length > PREVIEW_GROUP_COUNT ? (
                <Text className="text-white/35 text-[13px] text-center mt-1 mb-2">
                  +{(displayGroups.length - PREVIEW_GROUP_COUNT).toLocaleString()} more groups ready to review
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleStartReview(item.key)}
                accessibilityRole="button"
                className="mb-3 active:opacity-80"
              >
                <GroupCollage uris={item.previewUris} memberCount={item.memberIds.length} />
                <View className="flex-row items-center justify-between mt-1.5 px-0.5">
                  <Text className="text-white text-[13px] font-semibold">
                    {item.memberIds.length} photos
                  </Text>
                  <Text className="text-white/45 text-[12px]">
                    {formatBytes(item.reclaimBytes)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Sticky CTA — available whenever loaded groups exist, including during
          a rescan (the session snapshots its groups at start, so a scan
          finishing mid-review can't affect it). Notes sit above the button so
          the pill can hug the tab bar. */}
      {displayGroups.length > 0 && (
        <View
          className="absolute left-5 right-5"
          style={{ bottom: Math.max(insets.bottom, 26) + 66 }}
        >
          {scanning ? (
            <Text className="text-white/35 text-[11px] text-center mb-2">
              Scan running — reviewing already-found groups
            </Text>
          ) : (
            !analyzerUsed &&
            scannedAt > 0 && (
              <Text className="text-white/35 text-[11px] text-center mb-2">
                Grouped by time only — visual matching unavailable on this build
              </Text>
            )
          )}
          <GradientPillButton
            label={`Review ${reviewCount} group${reviewCount === 1 ? '' : 's'}`}
            icon="sparkles"
            variant="freed"
            onPress={handleStartReview}
          />
        </View>
      )}
    </View>
  );
}
