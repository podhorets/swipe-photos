import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { GRADIENTS } from '@/constants/theme';
import { yearsAgoLabel } from '@/lib/dateUtils';
import { getOnThisDayByYear } from '@/lib/gallery/grouper';
import { effectiveBatchSize } from '@/lib/planUtils';
import { posthog } from '@/lib/posthog';
import { gateSessionStart } from '@/lib/sessionGate';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { usePlanStore } from '@/stores/planStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AssetMeta } from '@/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  SectionList,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TILE_WIDTH = 104;
const TILE_HEIGHT = 130;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearSection {
  year: number;
  reviewed: number;
  // SectionList renders each element of `data` as a separate row.
  // We use a single-element array so the whole year renders as one horizontal strip.
  data: [AssetMeta[]];
}

function reviewYear(year: number) {
  if (!gateSessionStart()) return;
  router.push({
    pathname: '/review/[sessionId]',
    params: { sessionId: 'on-this-day', year: String(year) },
  });
}

// ─── Day summary (top of screen) ──────────────────────────────────────────────

function DaySummary({
  reviewed,
  total,
  yearCount,
}: {
  reviewed: number;
  total: number;
  yearCount: number;
}) {
  const ratio = total > 0 ? reviewed / total : 0;
  const left = total - reviewed;
  return (
    <GlassCard radius={24} className="mb-4">
      <View className="px-4 py-3.5 flex-row items-center gap-3.5">
        <ProgressRing
          size={64}
          radius={26}
          strokeWidth={6}
          progress={ratio}
          gradientColors={GRADIENTS.accent}
        >
          <Text className="text-white text-[15px] font-extrabold">
            {Math.round(ratio * 100)}%
          </Text>
        </ProgressRing>
        <View className="flex-1">
          <Text className="text-white text-[17px] font-extrabold" style={{ letterSpacing: -0.3 }}>
            {reviewed} of {total} reviewed
          </Text>
          <Text className="text-white/45 text-[13px] mt-0.5">
            {left > 0
              ? `${left} photo${left === 1 ? '' : 's'} left across ${yearCount} year${yearCount === 1 ? '' : 's'}`
              : `All done across ${yearCount} year${yearCount === 1 ? '' : 's'} 🎉`}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

// ─── Photo tile ───────────────────────────────────────────────────────────────

function PhotoTile({ asset }: { asset: AssetMeta }) {
  return (
    <Pressable
      onPress={() =>
        // Asset ids contain slashes — a template-string URL matches no route
        router.push({ pathname: '/review/preview/[assetId]', params: { assetId: asset.id } })
      }
      className="active:opacity-80"
      style={{ marginRight: 8 }}
    >
      <Image
        source={{ uri: asset.uri }}
        style={{
          width: TILE_WIDTH,
          height: TILE_HEIGHT,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
        contentFit="cover"
        recyclingKey={asset.id}
      />
      {asset.mediaType === 'video' && (
        <View className="absolute bottom-1.5 left-1.5 bg-black/60 rounded px-1 py-0.5 flex-row items-center">
          <Ionicons name="play" size={9} color="white" />
        </View>
      )}
    </Pressable>
  );
}

// ─── Section header + per-year progress ──────────────────────────────────────

function YearHeader({
  year,
  count,
  reviewed,
}: {
  year: number;
  count: number;
  reviewed: number;
}) {
  const pct = count > 0 ? Math.round((reviewed / count) * 100) : 0;
  return (
    <>
      <View className="flex-row items-center justify-between px-5 mb-1.5">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-white text-[19px] font-extrabold" style={{ letterSpacing: -0.3 }}>
            {year}
          </Text>
          <Text className="text-white/40 text-[13px]">
            {yearsAgoLabel(year)} · {count} photo{count === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable onPress={() => reviewYear(year)} className="active:opacity-60" hitSlop={8}>
          <Text className="text-accent text-[13px] font-bold">
            {reviewed}/{count} · {pct}%
          </Text>
        </Pressable>
      </View>
      <View className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden mx-5 mb-2.5">
        <View
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </View>
    </>
  );
}

// ─── Photo strip (one per year) ───────────────────────────────────────────────

function PhotoStrip({ photos }: { photos: AssetMeta[] }) {
  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PhotoTile asset={item} />}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 18 }}
    />
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name="calendar-outline" size={64} color="rgba(255,255,255,0.12)" />
      <Text className="text-white text-xl font-semibold text-center">No memories for today</Text>
      <Text className="text-white/40 text-base text-center">
        Photos taken on {dateStr} in past years will appear here.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnThisDayScreen() {
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const keepIds = useKeepStore((s) => s.keepIds);
  const planState = usePlanStore();
  const batchSize = useSettingsStore((s) => s.batchSize);

  // Every year renders the same strip (no hero); reviewed = kept photos,
  // same semantics as the Home progress ring (deleted photos leave the index)
  const { sections, yearCount, totalPhotos, totalReviewed } = useMemo(() => {
    const grouped = getOnThisDayByYear(index, new Date());
    const all = Array.from(grouped.entries())
      .sort(([a], [b]) => b - a) // most recent year first
      .map(([year, assets]): YearSection => ({
        year,
        reviewed: assets.filter((a) => keepIds.has(a.id)).length,
        data: [assets] as [AssetMeta[]],
      }));
    return {
      sections: all,
      yearCount: all.length,
      totalPhotos: all.reduce((n, s) => n + s.data[0].length, 0),
      totalReviewed: all.reduce((n, s) => n + s.reviewed, 0),
    };
  }, [index, keepIds]);

  const unreviewed = totalPhotos - totalReviewed;
  // Label matches the actual session size (Similar-tab convention): a session
  // is clamped by the effective batch size, 25 on the free plan
  const reviewCount = Math.min(unreviewed, effectiveBatchSize(planState, batchSize));

  function handleStartReview() {
    if (!gateSessionStart()) return;
    posthog.capture('review_session_started', {
      category: 'on-this-day',
      photo_count: totalPhotos,
    });
    router.push('/review/on-this-day');
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const titleBlock = (
    <View className="px-5 pb-[18px]" style={{ paddingTop: insets.top + 16 }}>
      <Text className="text-white text-[34px] font-extrabold" style={{ letterSpacing: -0.8 }}>
        On This Day
      </Text>
      <Text className="text-white/45 text-[15px] mt-1">
        {dateStr}
        {yearCount > 0 && ` · ${yearCount} year${yearCount === 1 ? '' : 's'} of memories`}
      </Text>
    </View>
  );

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-bg-dark">
        {titleBlock}
        <EmptyState />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="default" />
      <SectionList<AssetMeta[], YearSection>
        sections={sections}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item }) => <PhotoStrip photos={item} />}
        renderSectionHeader={({ section }) => (
          <YearHeader
            year={section.year}
            count={section.data[0].length}
            reviewed={section.reviewed}
          />
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 190 }}
        style={{ width: SCREEN_WIDTH }}
        ListHeaderComponent={
          <>
            {titleBlock}
            {/* Day review summary */}
            <View className="px-5">
              <DaySummary reviewed={totalReviewed} total={totalPhotos} yearCount={yearCount} />
            </View>
          </>
        }
      />

      {/* Sticky review CTA — same pattern as the Similar tab; hidden once done */}
      {unreviewed > 0 && (
        <View
          className="absolute left-5 right-5"
          style={{ bottom: Math.max(insets.bottom, 26) + 66 }}
        >
          <GradientPillButton
            label={`Review ${reviewCount} photo${reviewCount === 1 ? '' : 's'}`}
            icon="sparkles"
            onPress={handleStartReview}
          />
        </View>
      )}
    </View>
  );
}
