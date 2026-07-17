import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
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
import { posthog } from '@/lib/posthog';
import type { AssetMeta } from '@/types';

interface DisplayGroup {
  key: string;
  memberIds: string[];
  coverUri: string | null;
  reclaimBytes: number;
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
      return {
        key: memberIds[0],
        memberIds,
        coverUri: assetById.get(best)?.uri ?? null,
        reclaimBytes,
      };
    });
  }, [groups, keepIds, index, bestIds, assetById]);

  const totalPhotos = displayGroups.reduce((n, g) => n + g.memberIds.length, 0);
  const totalReclaim = displayGroups.reduce((n, g) => n + g.reclaimBytes, 0);
  const reviewCount = Math.min(
    displayGroups.length,
    effectiveBatchSize(planState, batchSize),
  );

  function handleStartReview() {
    if (!gateSessionStart()) return;
    posthog.capture('similar_review_started', { group_count: reviewCount });
    router.push('/review/similar');
  }

  const scanning = scanState === 'scanning';

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="by-month" />

      <View
        className="flex-1 px-5"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text
          className="text-white text-[34px] font-extrabold mb-1"
          style={{ letterSpacing: -0.8 }}
        >
          Similar
        </Text>
        <Text className="text-white/50 text-sm mb-4">
          {scanning
            ? 'Finding lookalike shots…'
            : displayGroups.length > 0
              ? `${displayGroups.length} groups · ${totalPhotos} photos · ~${formatBytes(totalReclaim)} to free`
              : 'Near-duplicate photos, grouped for quick cleanup'}
        </Text>

        {/* Scan progress */}
        {scanning && (
          <GlassCard radius={22} className="mb-4">
            <View className="p-4">
              <Text className="text-white/60 text-sm mb-2">
                {scanProgress?.phase === 'analyze'
                  ? 'Picking the best of each group…'
                  : 'Comparing photos on-device…'}
                {scanProgress ? ` ${scanProgress.processed.toLocaleString()} of ${scanProgress.total.toLocaleString()}` : ''}
              </Text>
              <ProgressBar
                progress={scanProgress && scanProgress.total > 0 ? scanProgress.processed / scanProgress.total : 0}
              />
            </View>
          </GlassCard>
        )}

        {/* Group list / empty states */}
        {!scanning && displayGroups.length === 0 ? (
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
        ) : (
          <FlatList
            data={displayGroups}
            keyExtractor={(g) => g.key}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 190 }}
            renderItem={({ item }) => (
              <Pressable onPress={handleStartReview} accessibilityRole="button">
                <GlassCard noBlur radius={22} className="mb-3">
                  <View className="flex-row items-center p-3 gap-3">
                    {item.coverUri && (
                      <Image
                        source={{ uri: item.coverUri }}
                        style={{ width: 64, height: 64, borderRadius: 14 }}
                        contentFit="cover"
                      />
                    )}
                    <View className="flex-1">
                      <Text className="text-white text-[15px] font-bold">
                        {item.memberIds.length} similar photos
                      </Text>
                      <Text className="text-white/45 text-[13px] mt-0.5">
                        Keep the best · free ~{formatBytes(item.reclaimBytes)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.3)" />
                  </View>
                </GlassCard>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Sticky CTA */}
      {displayGroups.length > 0 && !scanning && (
        <View
          className="absolute left-5 right-5"
          style={{ bottom: insets.bottom + 96 }}
        >
          <GradientPillButton
            label={`Review ${reviewCount} group${reviewCount === 1 ? '' : 's'}`}
            icon="sparkles"
            onPress={handleStartReview}
          />
          {!analyzerUsed && scannedAt > 0 && (
            <Text className="text-white/35 text-[11px] text-center mt-2">
              Grouped by time only — visual matching unavailable on this build
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
