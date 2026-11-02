import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, type ListRenderItemInfo } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { BlurPanel } from '@/components/glass/BlurPanel';
import { FeedCard } from '@/components/feed/FeedCard';
import { useGalleryStore } from '@/stores/galleryStore';
import { useFeedStore } from '@/stores/feedStore';
import { usePlacesStore } from '@/stores/placesStore';
import { buildFeedStories, type FeedStory } from '@/lib/feed/stories';
import { nearestPlace } from '@/lib/places/nearestPlace';
import { gateSessionStart } from '@/lib/sessionGate';
import { GRADIENTS } from '@/constants/theme';
import type { AssetMeta } from '@/types';

/**
 * PROOF OF CONCEPT — Instagram-style feed. Stories on top start a swipe
 * session; below, the whole library shuffled, with like and dislike.
 * Disliked photos wait in Trash (top-right) until deleted.
 */

// Smallest group that becomes a story; tap the chip to cycle
const STORY_SIZES = [3, 6, 10] as const;

/** Seeded shuffle, so the order stays put while the screen is open. */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function StoryCircle({ story, seen, onPress }: { story: FeedStory; seen: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}, ${story.ids.length} photos. Starts a review.`}
      className="items-center w-[78px] active:opacity-70"
    >
      <LinearGradient
        colors={seen ? ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.25)'] : GRADIENTS.notify}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{ width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' }}
      >
        <View className="w-[64px] h-[64px] rounded-full overflow-hidden border-[3px] border-bg-dark">
          <Image source={{ uri: story.coverUri }} style={{ flex: 1 }} contentFit="cover" />
        </View>
      </LinearGradient>
      <Text className="text-white text-[12px] mt-1.5" numberOfLines={1}>
        {story.title}
      </Text>
    </Pressable>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const liked = useFeedStore((s) => s.liked);
  const trashed = useFeedStore((s) => s.trashed);
  const seenStories = useFeedStore((s) => s.seenStories);
  const locations = usePlacesStore((s) => s.locations);
  const scanning = usePlacesStore((s) => s.scanning);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));

  // Read GPS for photos not checked yet — one native call per 2,000 photos
  useEffect(() => {
    if (index.length > 0) usePlacesStore.getState().scan(index.map((a) => a.id));
  }, [index]);

  const minSize = STORY_SIZES[sizeIdx];
  const stories = useMemo(() => buildFeedStories(index, locations, minSize), [index, locations, minSize]);

  const shuffled = useMemo(() => shuffle(index, seed), [index, seed]);
  const feed = useMemo(() => {
    const gone = new Set(trashed);
    return shuffled.filter((a) => !gone.has(a.id));
  }, [shuffled, trashed]);

  const placeFor = useCallback(
    (id: string) => {
      const loc = locations[id];
      if (!loc) return null;
      const p = nearestPlace(loc[0], loc[1]);
      return p ? (p.city ? `${p.city}, ${p.country}` : p.country) : null;
    },
    [locations],
  );

  const onLike = useCallback((id: string) => useFeedStore.getState().toggleLike(id), []);
  const onDislike = useCallback((id: string) => useFeedStore.getState().trash(id), []);

  function openStory(story: FeedStory) {
    if (!gateSessionStart()) return;
    const store = useFeedStore.getState();
    store.markStorySeen(story.key);
    store.setPendingStory({ title: story.title, ids: story.ids });
    router.push('/review/story');
  }

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AssetMeta>) => (
      <FeedCard
        asset={item}
        place={placeFor(item.id)}
        liked={liked.has(item.id)}
        onLike={onLike}
        onDislike={onDislike}
      />
    ),
    [placeFor, liked, onLike, onDislike],
  );

  const header = (
    <View className="mb-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-3 gap-1">
        {stories.map((s) => (
          <StoryCircle key={s.key} story={s} seen={seenStories.has(s.key)} onPress={() => openStory(s)} />
        ))}
        {stories.length === 0 && (
          <Text className="text-white/45 text-[13px] px-2 py-6">No groups of {minSize}+ photos yet</Text>
        )}
      </ScrollView>
      <View className="flex-row items-center justify-between px-4 mt-2">
        <Pressable
          onPress={() => setSizeIdx((i) => (i + 1) % STORY_SIZES.length)}
          accessibilityRole="button"
          accessibilityLabel={`Stories need ${minSize} or more photos. Tap to change.`}
          className="flex-row items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 active:opacity-70"
        >
          <Ionicons name="options-outline" size={13} color="white" />
          <Text className="text-white text-[12px] font-semibold">Stories of {minSize}+ photos</Text>
        </Pressable>
        {scanning && <Text className="text-white/45 text-[12px]">Finding places…</Text>}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="by-month" />

      {/* Fixed header: title and the Trash counter */}
      <View className="flex-row items-center justify-between px-5 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text className="text-white text-[30px] font-extrabold" style={{ letterSpacing: -0.6 }}>
          Feed
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/trash', params: { source: 'feed' } })}
          accessibilityRole="button"
          accessibilityLabel={`Trash, ${trashed.length} photos`}
          hitSlop={6}
          className="w-11 h-11 rounded-full overflow-hidden items-center justify-center border border-white/[0.16]"
        >
          <BlurPanel intensity={40} />
          <Ionicons name="trash-outline" size={20} color="white" />
          {trashed.length > 0 && (
            <View className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-[#FF453A] items-center justify-center">
              <Text className="text-white text-[11px] font-bold">{trashed.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Animated.FlatList
        data={feed}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        itemLayoutAnimation={LinearTransition.duration(220)}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      />
    </View>
  );
}
