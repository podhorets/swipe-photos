import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, RefreshControl, type ListRenderItemInfo } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurPanel } from '@/components/glass/BlurPanel';
import { FeedPost, type FeedPostData } from '@/components/feed/FeedPost';
import { FlyingPhoto, type Rect } from '@/components/feed/FlyingPhoto';
import { useGalleryStore } from '@/stores/galleryStore';
import { useFeedStore } from '@/stores/feedStore';
import { usePlacesStore } from '@/stores/placesStore';
import { useSimilarStore } from '@/stores/similarStore';
import { buildFeedStories, type FeedStory } from '@/lib/feed/stories';
import { filterGroupsForReview } from '@/lib/similar/filterGroups';
import { nearestPlace } from '@/lib/places/nearestPlace';
import { gateSessionStart } from '@/lib/sessionGate';
import { GRADIENTS, SPRING } from '@/constants/theme';
import type { AssetMeta } from '@/types';

/**
 * PROOF OF CONCEPT — social-style feed (exempt from the glass rule, see
 * CLAUDE.md). Stories on top start a swipe session; below, the library
 * shuffled, Similar groups as carousels, with like / dislike / bookmark.
 * Disliked photos wait in Trash (top-right) until deleted.
 */

// Smallest group that becomes a story; long-press a story to change it
const STORY_SIZES = [3, 6, 10] as const;
const BAR_HEIGHT = 50;
// Posts below slide up into a removed post's place — slow enough to follow
const GAP_CLOSE = LinearTransition.duration(380).easing(Easing.out(Easing.cubic));
const NO_KEEPS: Set<string> = new Set();

/** Seeded shuffle, so the order stays put until pull-to-refresh. */
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

function StoryCircle({
  story,
  seen,
  onPress,
  onLongPress,
}: {
  story: FeedStory;
  seen: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}, ${story.ids.length} photos. Starts a review.`}
      className="items-center w-[74px] active:opacity-70"
    >
      {seen ? (
        <View className="w-[66px] h-[66px] rounded-full border border-white/30 items-center justify-center">
          <View className="w-[60px] h-[60px] rounded-full overflow-hidden">
            <Image source={{ uri: story.coverUri }} style={{ flex: 1 }} contentFit="cover" />
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={GRADIENTS.notify}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{ width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' }}
        >
          <View className="w-[62px] h-[62px] rounded-full overflow-hidden border-[2.5px] border-black">
            <Image source={{ uri: story.coverUri }} style={{ flex: 1 }} contentFit="cover" />
          </View>
        </LinearGradient>
      )}
      <Text className="text-white text-[12px] mt-1 w-[70px] text-center" numberOfLines={1}>
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
  const favorites = useFeedStore((s) => s.favorites);
  const locations = usePlacesStore((s) => s.locations);
  const scanning = usePlacesStore((s) => s.scanning);
  const similarGroups = useSimilarStore((s) => s.groups);
  const bestIds = useSimilarStore((s) => s.bestIds);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  // Read GPS and Favorites for photos — on the device, in bulk
  useEffect(() => {
    if (index.length === 0) return;
    const ids = index.map((a) => a.id);
    usePlacesStore.getState().scan(ids);
    useFeedStore.getState().loadFavorites(ids).catch(() => {});
  }, [index]);

  const minSize = STORY_SIZES[sizeIdx];
  const stories = useMemo(() => buildFeedStories(index, locations, minSize), [index, locations, minSize]);

  // Disliked photos in flight to the Trash icon. They leave the feed at once
  // (`flying`); the Trash count goes up when each one lands.
  const [flights, setFlights] = useState<{ asset: AssetMeta; from: Rect; to: { x: number; y: number }; ready: boolean }[]>([]);
  // A card leaves only once its flying copy is on screen over it
  const flying = useMemo(() => new Set(flights.filter((f) => f.ready).map((f) => f.asset.id)), [flights]);
  const trashButtonRef = useRef<View>(null);
  // Top bar offset: 0 = shown, -BAR_HEIGHT = title row scrolled away
  const barY = useSharedValue(0);
  const bump = useSharedValue(1);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  // Posts: every photo, shuffled; a Similar group becomes one carousel post
  // (best shot first) at the position of its first member.
  const allPosts = useMemo<FeedPostData[]>(() => {
    const byId = new Map(index.map((a) => [a.id, a]));
    const groups = filterGroupsForReview(similarGroups, NO_KEEPS, new Set(byId.keys()));
    const groupOf = new Map<string, number>();
    groups.forEach((g, i) => g.forEach((id) => groupOf.set(id, i)));
    const emitted = new Set<number>();
    const posts: FeedPostData[] = [];
    for (const asset of shuffle(index, seed)) {
      const g = groupOf.get(asset.id);
      if (g === undefined) {
        posts.push({ key: asset.id, assets: [asset], groupSize: 1 });
        continue;
      }
      if (emitted.has(g)) continue;
      emitted.add(g);
      const members = [...groups[g]]
        .sort((a, b) => Number(bestIds.has(b)) - Number(bestIds.has(a)))
        .map((id) => byId.get(id)!)
        .filter(Boolean);
      posts.push({ key: `g:${groups[g][0]}`, assets: members, groupSize: members.length });
    }
    return posts;
  }, [index, similarGroups, bestIds, seed]);

  const posts = useMemo(() => {
    const gone = new Set(trashed);
    const out: FeedPostData[] = [];
    for (const p of allPosts) {
      const assets = p.assets.filter((a) => !gone.has(a.id) && !liked.has(a.id) && !flying.has(a.id));
      if (assets.length > 0) out.push(assets.length === p.assets.length ? p : { ...p, assets });
    }
    return out;
  }, [allPosts, trashed, liked, flying]);

  const placeFor = useCallback(
    (id: string) => {
      const loc = locations[id];
      return loc ? nearestPlace(loc[0], loc[1]) : null;
    },
    [locations],
  );

  const onLiked = useCallback((id: string) => useFeedStore.getState().toggleLike(id), []);
  const onDislike = useCallback(
    (asset: AssetMeta, from: Rect) => {
      trashButtonRef.current?.measureInWindow((x, y, w, h) => {
        // The bar may be scrolled away: bring it back and aim at where the
        // icon comes to rest, not where it is hidden right now
        const restY = y + h / 2 - barY.value;
        barY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
        setFlights((f) => [...f, { asset, from, to: { x: x + w / 2, y: restY }, ready: false }]);
      });
    },
    [barY],
  );
  const onReady = useCallback((id: string) => {
    setFlights((f) => f.map((x) => (x.asset.id === id ? { ...x, ready: true } : x)));
  }, []);
  const onArrive = useCallback(
    (id: string) => {
      useFeedStore.getState().trash(id);
      setFlights((f) => f.filter((x) => x.asset.id !== id));
      Haptics.selectionAsync();
      bump.value = withSequence(withSpring(1.22, SPRING.press), withSpring(1, SPRING.press));
    },
    [bump],
  );
  const onToggleFavorite = useCallback((id: string) => {
    useFeedStore
      .getState()
      .toggleFavorite(id)
      .catch(() => Alert.alert('Couldn’t Update Favorites', 'Photos didn’t allow the change. Please try again.'));
  }, []);

  function openStory(story: FeedStory) {
    if (!gateSessionStart()) return;
    const store = useFeedStore.getState();
    store.markStorySeen(story.key);
    store.setPendingStory({ title: story.title, ids: story.ids });
    router.push('/review/story');
  }

  function chooseStorySize() {
    Alert.alert('Story size', 'Show groups with at least…', [
      ...STORY_SIZES.map((n, i) => ({ text: `${n} photos`, onPress: () => setSizeIdx(i) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  // Top bar hides while scrolling down and returns on any scroll up
  const barTotal = insets.top + BAR_HEIGHT;
  const lastY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const dy = y - lastY.value;
    lastY.value = y;
    // Only the title row slides away; a strip stays behind the status bar
    barY.value = y <= 0 ? 0 : Math.min(0, Math.max(-BAR_HEIGHT, barY.value - dy));
  });
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: barY.value }] }));
  const barContentStyle = useAnimatedStyle(() => ({ opacity: 1 + barY.value / BAR_HEIGHT }));

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FeedPostData>) => (
      <FeedPost
        post={item}
        place={placeFor(item.assets[0].id)}
        favorites={favorites}
        onLiked={onLiked}
        onDislike={onDislike}
        onToggleFavorite={onToggleFavorite}
      />
    ),
    [placeFor, favorites, onLiked, onDislike, onToggleFavorite],
  );

  const storiesRow = (
    <View className="pb-2.5 mb-1 border-b border-white/[0.12]">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-2.5 gap-1.5">
        {stories.map((s) => (
          <StoryCircle
            key={s.key}
            story={s}
            seen={seenStories.has(s.key)}
            onPress={() => openStory(s)}
            onLongPress={chooseStorySize}
          />
        ))}
        {stories.length === 0 && (
          <Pressable onPress={chooseStorySize} className="py-6 px-2">
            <Text className="text-white/45 text-[13px]">No groups of {minSize}+ photos yet · Change</Text>
          </Pressable>
        )}
      </ScrollView>
      {scanning && <Text className="text-white/45 text-[11px] px-3.5 mt-1.5">Finding places…</Text>}
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <Animated.FlatList
        data={posts}
        keyExtractor={(p) => p.key}
        renderItem={renderItem}
        ListHeaderComponent={storiesRow}
        itemLayoutAnimation={GAP_CLOSE}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        contentContainerStyle={{ paddingTop: barTotal + 6, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => setSeed(Math.floor(Math.random() * 1e9))}
            tintColor="white"
            progressViewOffset={barTotal}
          />
        }
      />

      {/* Top bar: glass, hides on scroll down */}
      <Animated.View className="absolute top-0 left-0 right-0" style={[{ height: barTotal }, barStyle]}>
        <BlurPanel intensity={70} />
        <Animated.View
          className="flex-1 flex-row items-end justify-between px-4 pb-2"
          style={[{ paddingTop: insets.top }, barContentStyle]}
        >
          <Text className="text-white text-[25px] font-extrabold" style={{ letterSpacing: -0.6 }}>
            Swipe Photos
          </Text>
          <Animated.View ref={trashButtonRef} style={bumpStyle} collapsable={false}>
            <Pressable
              onPress={() => router.push({ pathname: '/trash', params: { source: 'feed' } })}
              accessibilityRole="button"
              accessibilityLabel={`Trash, ${trashed.length} photos`}
              hitSlop={8}
              className="w-10 h-10 items-center justify-center"
            >
              <Ionicons name="trash-outline" size={25} color="white" />
            </Pressable>
            {trashed.length > 0 && (
              <View
                className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3040] items-center justify-center border-2 border-black"
                pointerEvents="none"
              >
                <Text className="text-white text-[10px] font-bold">{trashed.length}</Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Disliked photos on their way to the Trash icon, above everything */}
      {flights.map((f) => (
        <FlyingPhoto
          key={f.asset.id}
          uri={f.asset.uri}
          from={f.from}
          to={f.to}
          onReady={() => onReady(f.asset.id)}
          onArrive={() => onArrive(f.asset.id)}
        />
      ))}
    </View>
  );
}
