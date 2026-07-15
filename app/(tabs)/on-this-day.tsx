import { useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  Pressable,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { getOnThisDayByYear } from '@/lib/gallery/grouper';
import { yearsAgoLabel } from '@/lib/dateUtils';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import type { AssetMeta } from '@/types';
import { gateSessionStart } from '@/lib/sessionGate';

const TILE_WIDTH = 104;
const TILE_HEIGHT = 130;
const SCREEN_WIDTH = Dimensions.get('window').width;

const HERO_SCRIM = ['rgba(5,5,8,0.05)', 'rgba(5,5,8,0.85)'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearSection {
  year: number;
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

// ─── Hero card (most recent year) ─────────────────────────────────────────────

function HeroMemory({ year, photos }: { year: number; photos: AssetMeta[] }) {
  return (
    <View
      className="rounded-[28px] overflow-hidden border border-white/[0.16] mb-4"
      style={{ height: 300 }}
    >
      <Image
        source={{ uri: photos[0]?.uri }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        recyclingKey={photos[0]?.id}
        transition={150}
      />
      <LinearGradient
        colors={HERO_SCRIM}
        locations={[0.3, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View className="absolute left-[18px] right-[18px] bottom-4 flex-row items-end justify-between">
        <View>
          <Text
            className="text-white/65 text-[13px] font-semibold"
            style={{ letterSpacing: 0.78 }}
          >
            {yearsAgoLabel(year).toUpperCase()}
          </Text>
          <Text className="text-white text-[26px] font-extrabold mt-0.5" style={{ letterSpacing: -0.5 }}>
            {year}
          </Text>
          <Text className="text-white/60 text-[13px] mt-px">
            {photos.length} photo{photos.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={() => reviewYear(year)}
          className="flex-row items-center gap-1.5 px-[18px] py-[11px] rounded-full bg-white/[0.92] active:opacity-80"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <Ionicons name="play" size={14} color="#050508" />
          <Text className="text-[#050508] font-bold text-sm">Review</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Photo tile ───────────────────────────────────────────────────────────────

function PhotoTile({ asset }: { asset: AssetMeta }) {
  return (
    <Pressable
      onPress={() => router.push(`/review/preview/${asset.id}`)}
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

// ─── Section header ───────────────────────────────────────────────────────────

function YearHeader({ year, count }: { year: number; count: number }) {
  return (
    <View className="flex-row items-center justify-between px-5 mb-2.5">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-white text-[19px] font-extrabold" style={{ letterSpacing: -0.3 }}>
          {year}
        </Text>
        <Text className="text-white/40 text-[13px]">
          {yearsAgoLabel(year)} · {count} photo{count === 1 ? '' : 's'}
        </Text>
      </View>
      <Pressable onPress={() => reviewYear(year)} className="active:opacity-60" hitSlop={8}>
        <Text className="text-accent text-sm font-semibold">Review</Text>
      </Pressable>
    </View>
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

  const { heroSection, restSections, yearCount } = useMemo(() => {
    const grouped = getOnThisDayByYear(index, new Date());
    const all = Array.from(grouped.entries())
      .sort(([a], [b]) => b - a) // most recent year first
      .map(([year, assets]): YearSection => ({ year, data: [assets] as [AssetMeta[]] }));
    return {
      heroSection: all[0],
      restSections: all.slice(1),
      yearCount: all.length,
    };
  }, [index]);

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

  if (!heroSection) {
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
        sections={restSections}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item }) => <PhotoStrip photos={item} />}
        renderSectionHeader={({ section }) => (
          <YearHeader year={section.year} count={section.data[0].length} />
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        style={{ width: SCREEN_WIDTH }}
        ListHeaderComponent={
          <>
            {titleBlock}
            <View className="px-5">
              <HeroMemory year={heroSection.year} photos={heroSection.data[0]} />
            </View>
          </>
        }
      />
    </View>
  );
}
