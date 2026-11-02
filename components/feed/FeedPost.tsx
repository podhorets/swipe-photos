import React, { memo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActionSheetIOS, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS, GRADIENTS, SCREEN, SPRING } from '@/constants/theme';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { formatBytes } from '@/lib/dateUtils';
import type { Place } from '@/lib/places/nearestPlace';
import type { AssetMeta } from '@/types';
import type { Rect } from '@/components/feed/FlyingPhoto';

// Instagram's crop range: 4:5 portrait to 1.91:1 landscape
const MIN_RATIO = 1 / 1.91;
const MAX_RATIO = 1.25;
const W = SCREEN.width;

export interface FeedPostData {
  /** Stable for the whole group, even as its photos leave */
  key: string;
  /** Photos still in the feed; 2+ makes a swipeable carousel */
  assets: AssetMeta[];
  /** Size of the Similar group this post came from (1 = single photo) */
  groupSize: number;
}

interface FeedPostProps {
  post: FeedPostData;
  place: Place | null;
  favorites: Set<string>;
  onLiked: (id: string) => void;
  onDislike: (asset: AssetMeta, frame: Rect) => void;
  onToggleFavorite: (id: string) => void;
}

function relativeDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function monthYear(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * One feed post, laid out like a social feed: an account-style header (place
 * or month), the photo edge to edge (a carousel for Similar groups), an icon
 * row (like, dislike · bookmark = iOS Favorite) and a short caption.
 * Likes pop a heart and lift away; dislikes fly into the Trash icon.
 */
export const FeedPost = memo(function FeedPost({
  post,
  place,
  favorites,
  onLiked,
  onDislike,
  onToggleFavorite,
}: FeedPostProps) {
  const { assets } = post;
  const [page, setPage] = useState(0);
  const current = assets[Math.min(page, assets.length - 1)];
  const lead = assets[0];
  const ratio = Math.min(Math.max(lead.height / Math.max(lead.width, 1), MIN_RATIO), MAX_RATIO);
  const height = W * ratio;
  const multi = assets.length > 1;

  const photoRef = useRef<View>(null);
  const leaving = useRef(new Set<string>());
  const burst = useSharedValue(0);
  const lift = useSharedValue(0);
  const hidden = useSharedValue(0);

  function like(asset: AssetMeta) {
    if (leaving.current.has(asset.id)) return;
    leaving.current.add(asset.id);
    burst.value = withSequence(withSpring(1, SPRING.snappy), withDelay(250, withTiming(0, { duration: 200 })));
    if (multi) {
      // The photo leaves the carousel; the post stays for the rest
      setTimeout(() => onLiked(asset.id), 520);
      return;
    }
    // Last photo: the whole post floats up and fades — "saved"
    lift.value = withDelay(
      380,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(onLiked, asset.id);
      }),
    );
  }

  function dislike(asset: AssetMeta) {
    if (leaving.current.has(asset.id)) return;
    leaving.current.add(asset.id);
    photoRef.current?.measureInWindow((x, y, width, h) => {
      if (!multi) hidden.value = 1;
      onDislike(asset, { x, y, width, height: h });
    });
  }

  function openMenu() {
    const fav = favorites.has(current.id);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Move to Trash', 'Keep', fav ? 'Remove from Favorites' : 'Add to Favorites', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 3,
      },
      (i) => {
        if (i === 0) dislike(current);
        else if (i === 1) like(current);
        else if (i === 2) onToggleFavorite(current.id);
      },
    );
  }

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(likeCurrent);
    });
  function likeCurrent() {
    like(current);
  }

  function onPageEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  }

  const cardStyle = useAnimatedStyle(() => ({
    opacity: hidden.value ? 0 : 1 - lift.value,
    transform: [{ translateY: -24 * lift.value }, { scale: 1 + 0.03 * lift.value }],
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.5 + burst.value * 0.7 }],
  }));

  const name = place?.city ?? place?.country ?? monthYear(lead.creationTime);
  const subtitle =
    post.groupSize > 1
      ? `Similar · ${assets.length} of ${post.groupSize} photos`
      : place?.city
        ? place.country
        : null;
  const isFav = favorites.has(current.id);

  return (
    <Animated.View style={cardStyle} className="mb-4">
      {/* Header: avatar, name, second line, menu */}
      <View className="flex-row items-center px-3 h-[54px] gap-2.5">
        <LinearGradient
          colors={GRADIENTS.notify}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}
        >
          <View className="w-[30px] h-[30px] rounded-full bg-black items-center justify-center">
            <Ionicons name={place ? 'location' : 'calendar'} size={14} color="white" />
          </View>
        </LinearGradient>
        <View className="flex-1">
          <Text className="text-white text-[14px] font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {subtitle && (
            <Text className="text-white/70 text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="More" hitSlop={8} className="w-9 h-9 items-center justify-center">
          <Ionicons name="ellipsis-horizontal" size={20} color="white" />
        </Pressable>
      </View>

      {/* Photo — edge to edge; a paged carousel for Similar groups */}
      <GestureDetector gesture={doubleTap}>
        <View ref={photoRef} collapsable={false} style={{ width: W, height }} className="bg-[#111]">
          {multi ? (
            <FlatList
              data={assets}
              keyExtractor={(a) => a.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPageEnd}
              renderItem={({ item }) => (
                <Image source={{ uri: item.uri }} style={{ width: W, height }} contentFit="cover" transition={150} />
              )}
            />
          ) : (
            <Image source={{ uri: lead.uri }} style={{ flex: 1 }} contentFit="cover" transition={150} recyclingKey={lead.id} />
          )}
          {multi && (
            <View className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60" pointerEvents="none">
              <Text className="text-white text-[12px] font-semibold">
                {Math.min(page, assets.length - 1) + 1}/{assets.length}
              </Text>
            </View>
          )}
          {current.mediaType === 'video' && (
            <View className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/55 items-center justify-center" pointerEvents="none">
              <Ionicons name="play" size={15} color="white" />
            </View>
          )}
          <Animated.View className="absolute inset-0 items-center justify-center" pointerEvents="none" style={burstStyle}>
            <Ionicons name="heart" size={96} color={COLORS.destructive} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Icon row: like · dislike … page dots … bookmark */}
      <View className="flex-row items-center px-1.5 h-[46px]">
        <Pressable onPress={() => like(current)} accessibilityRole="button" accessibilityLabel="Like — keeps the photo" className="w-11 h-11 items-center justify-center active:opacity-60">
          <Ionicons name="heart-outline" size={26} color="white" />
        </Pressable>
        <Pressable onPress={() => dislike(current)} accessibilityRole="button" accessibilityLabel="Dislike — move to Trash" className="w-11 h-11 items-center justify-center active:opacity-60">
          <Ionicons name="thumbs-down-outline" size={24} color="white" />
        </Pressable>
        <View className="flex-1 flex-row justify-center gap-1">
          {multi &&
            assets.map((a, i) => (
              <View
                key={a.id}
                className={`w-1.5 h-1.5 rounded-full ${i === Math.min(page, assets.length - 1) ? 'bg-[#0A84FF]' : 'bg-white/35'}`}
              />
            ))}
        </View>
        <View className="w-11" />
        <Pressable
          onPress={() => onToggleFavorite(current.id)}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Remove from Favorites in Photos' : 'Add to Favorites in Photos'}
          className="w-11 h-11 items-center justify-center active:opacity-60"
        >
          <Ionicons name={isFav ? 'bookmark' : 'bookmark-outline'} size={24} color="white" />
        </Pressable>
      </View>

      {/* Caption */}
      <View className="px-3.5">
        <Text className="text-white text-[14px]" numberOfLines={1}>
          <Text className="font-semibold">{name}</Text>
          {'  '}
          {formatBytes(estimateSizeFromAsset(current))}
          {isFav ? ' · Favorite' : ''}
        </Text>
        <Text className="text-white/50 text-[12px] mt-1">{relativeDate(current.creationTime)}</Text>
      </View>
    </Animated.View>
  );
});
