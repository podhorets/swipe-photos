import { Card } from '@/components/ui/Card';
import { BackCircle } from '@/components/ui/CircleButton';
import { EmptyState as Empty } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton, TintPill } from '@/components/ui/PrimaryButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { StatusBarScrim } from '@/components/ui/StatusBarScrim';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { getOnThisDayByYear } from '@/lib/gallery/grouper';
import { effectiveBatchSize } from '@/lib/planUtils';
import { posthog } from '@/lib/posthog';
import { gateSessionStart } from '@/lib/sessionGate';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { usePlanStore } from '@/stores/planStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AssetMeta } from '@/types';
import * as Haptics from 'expo-haptics';
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

const TILE_WIDTH = 100;
const TILE_HEIGHT = 125;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_X = 18;

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearSection {
  year: number;
  reviewed: number;
  // SectionList renders each element of `data` as a separate row.
  // We use a single-element array so the whole year renders as one horizontal strip.
  data: [AssetMeta[]];
}

function reviewYear(year: number, left: number) {
  Haptics.selectionAsync();
  if (!gateSessionStart()) return;
  posthog.capture('review_session_started', {
    category: 'on-this-day',
    year,
    photo_count: left,
  });
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
    <Card className="min-h-[84px] px-4 py-3 flex-row items-center gap-3.5 mb-5">
      <ProgressRing size={54} radius={24.5} strokeWidth={5} progress={ratio}>
        <Text className="text-fg text-[13px] font-extrabold">{Math.round(ratio * 100)}%</Text>
      </ProgressRing>
      <View className="flex-1">
        <Text className="font-display text-fg text-[18px]">
          {reviewed} of {total} reviewed
        </Text>
        <Text className="text-fg-2 text-[13px] mt-0.5">
          {left > 0
            ? `${left} photo${left === 1 ? '' : 's'} left across ${yearCount} year${yearCount === 1 ? '' : 's'}`
            : `All done across ${yearCount} year${yearCount === 1 ? '' : 's'} 🎉`}
        </Text>
      </View>
    </Card>
  );
}

// ─── Photo tile ───────────────────────────────────────────────────────────────

function PhotoTile({ asset }: { asset: AssetMeta }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() =>
        // Asset ids contain slashes — a template-string URL matches no route
        router.push({ pathname: '/review/preview/[assetId]', params: { assetId: asset.id } })
      }
      className="active:opacity-80 rounded-[14px] bg-track mr-2"
      style={{ boxShadow: t.shadow.card }}
    >
      <Image
        source={{ uri: asset.uri }}
        style={{ width: TILE_WIDTH, height: TILE_HEIGHT, borderRadius: 14 }}
        contentFit="cover"
        recyclingKey={asset.id}
      />
      {asset.mediaType === 'video' && (
        <View className="absolute bottom-1.5 left-1.5 bg-chip rounded-full w-5 h-5 items-center justify-center">
          <Icon name="play" size={10} color={t.photoChip.text} />
        </View>
      )}
    </Pressable>
  );
}

// ─── Section header + per-year progress ──────────────────────────────────────

function YearDoneChip() {
  const t = useTheme();
  return (
    <View className="flex-row items-center gap-1 rounded-full px-2.5 min-h-[32px] bg-keep-tint border border-keep-ring">
      <Icon name="check" size={13} color={t.keep.icon} strokeWidth={2.8} />
      <Text className="text-keep-text text-[13px] font-bold">Done</Text>
    </View>
  );
}

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
  const left = count - reviewed;
  const isDone = left === 0;
  // Per-year CTA carries the verb; the counts sit in the subtitle
  const label = reviewed > 0 ? 'Resume' : 'Review';
  return (
    <>
      <View className="flex-row items-center justify-between mb-2.5 gap-3" style={{ paddingHorizontal: SCREEN_X }}>
        <View className="flex-1 flex-row items-baseline gap-1.5">
          <Text className="font-display text-fg text-[22px]">{year}</Text>
          {/* Count and progress share one line — the bar below carries the percentage */}
          <Text className="text-fg-2 text-[13px] flex-1" numberOfLines={1}>
            {isDone
              ? `all ${count} reviewed`
              : reviewed === 0
                ? `${count} photo${count === 1 ? '' : 's'}`
                : `${reviewed} of ${count} reviewed`}
          </Text>
        </View>
        {isDone ? (
          <YearDoneChip />
        ) : (
          <TintPill label={`${label} ${left}`} onPress={() => reviewYear(year, left)} />
        )}
      </View>
      <View className="h-1 rounded-full bg-track overflow-hidden mb-2.5" style={{ marginHorizontal: SCREEN_X }}>
        <View
          className={`h-full rounded-full ${isDone ? 'bg-keep-ring' : 'bg-accent'}`}
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
      // Vertical room so the tile shadows aren't clipped
      contentContainerStyle={{ paddingHorizontal: SCREEN_X, paddingTop: 2, paddingBottom: 22 }}
    />
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return (
    <View className="flex-1 items-center justify-center pb-24">
      <Empty
        icon="calendar"
        color="amber"
        title="No memories for today"
        body={`Photos taken on ${dateStr} in past years will appear here.`}
      />
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
    <View className="pb-[18px]" style={{ paddingTop: insets.top + 8, paddingHorizontal: SCREEN_X }}>
      <BackCircle />
      <Text className="font-display text-fg text-[34px] leading-[37px] mt-3">On This Day</Text>
      <Text className="text-fg-2 text-[14.5px] mt-1">
        {dateStr}
        {yearCount > 0 && ` · ${yearCount} year${yearCount === 1 ? '' : 's'} of memories`}
      </Text>
    </View>
  );

  if (sections.length === 0) {
    return (
      <View className="flex-1">
        <ScreenBackground />
        {titleBlock}
        <EmptyState />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScreenBackground />
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        style={{ width: SCREEN_WIDTH }}
        ListHeaderComponent={
          <>
            {titleBlock}
            {/* Day review summary */}
            <View style={{ paddingHorizontal: SCREEN_X }}>
              <DaySummary reviewed={totalReviewed} total={totalPhotos} yearCount={yearCount} />
            </View>
          </>
        }
      />

      {/* Sticky review CTA — same pattern as the Similar tab; hidden once done */}
      {unreviewed > 0 && (
        <View
          className="absolute left-[18px] right-[18px]"
          style={{ bottom: Math.max(insets.bottom, 26) + 58 }}
        >
          <PrimaryButton
            floating
            label={`Review ${reviewCount} photo${reviewCount === 1 ? '' : 's'}`}
            icon="sparkle"
            onPress={handleStartReview}
          />
        </View>
      )}
      <StatusBarScrim />
    </View>
  );
}
