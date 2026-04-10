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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useGalleryStore } from '@/stores/galleryStore';
import { getOnThisDayByYear } from '@/lib/gallery/grouper';
import { yearsAgoLabel } from '@/lib/dateUtils';
import { GLASS } from '@/constants/theme';
import type { AssetMeta } from '@/types';

const TILE_SIZE = 110;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearSection {
  year: number;
  // SectionList renders each element of `data` as a separate row.
  // We use a single-element array so the whole year renders as one horizontal strip.
  data: [AssetMeta[]];
}

// ─── Photo tile ───────────────────────────────────────────────────────────────

function PhotoTile({ asset }: { asset: AssetMeta }) {
  return (
    <Pressable
      onPress={() => router.push(`/review/preview/${asset.id}`)}
      className="active:opacity-80"
      style={{ marginRight: 4 }}
    >
      <Image
        source={{ uri: asset.uri }}
        style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: 8 }}
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
    <BlurView
      intensity={GLASS.intensity.medium}
      tint={GLASS.tint}
      className="mx-4 mb-2 rounded-2xl overflow-hidden border border-white/15 px-4 py-3"
    >
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">{year}</Text>
          <Text className="text-white/40 text-sm mt-0.5">
            {yearsAgoLabel(year)} · {count} photo{count === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/review/[sessionId]',
              params: { sessionId: 'on-this-day', year: String(year) },
            })
          }
          className="bg-white/15 rounded-full px-4 py-2 active:opacity-60"
        >
          <Text className="text-white font-semibold text-sm">Review</Text>
        </Pressable>
      </View>
    </BlurView>
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
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
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

  const sections: YearSection[] = useMemo(() => {
    const grouped = getOnThisDayByYear(index, new Date());
    return Array.from(grouped.entries()).map(([year, assets]) => ({
      year,
      data: [assets] as [AssetMeta[]],
    }));
  }, [index]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  if (sections.length === 0) {
    return (
      <View className="flex-1 bg-black">
        <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-4">
          <Text className="text-white text-4xl font-bold">On This Day</Text>
          <Text className="text-white/40 text-base mt-1">{dateStr}</Text>
        </View>
        <EmptyState />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <SectionList<AssetMeta[], YearSection>
        sections={sections}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item }) => <PhotoStrip photos={item} />}
        renderSectionHeader={({ section }) => (
          <YearHeader year={section.year} count={section.data[0].length} />
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        style={{ width: SCREEN_WIDTH }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-4">
            <Text className="text-white text-4xl font-bold">On This Day</Text>
            <Text className="text-white/40 text-base mt-1">{dateStr}</Text>
            <Text className="text-white/30 text-sm mt-3">
              {sections.length} year{sections.length === 1 ? '' : 's'} of memories
            </Text>
          </View>
        }
      />
    </View>
  );
}
