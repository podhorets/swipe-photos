import React, { memo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, ActionSheetIOS, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
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
import * as Haptics from 'expo-haptics';
import { gatedHaptic } from '@/lib/haptics';
import { Icon } from '@/components/ui/Icon';
import { IconWell } from '@/components/ui/IconWell';
import { ON_PHOTO } from '@/constants/colors';
import { SCREEN, SPRING } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';
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
  const t = useTheme();
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
  const pop = useSharedValue(1);
  const [likedNow, setLikedNow] = useState(false);
  const lift = useSharedValue(0);

  function like(asset: AssetMeta) {
    if (leaving.current.has(asset.id)) return;
    leaving.current.add(asset.id);
    gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
    setLikedNow(true);
    // The button's heart fills red and pops — visible wherever the post is
    // scrolled, unlike the big heart on the photo
    pop.value = withSequence(withSpring(1.3, SPRING.press), withSpring(1, SPRING.press));
    burst.value = withSequence(withSpring(1, SPRING.snappy), withDelay(250, withTiming(0, { duration: 200 })));
    if (multi) {
      // The photo leaves the carousel; the post stays for the rest
      setTimeout(() => {
        setLikedNow(false);
        onLiked(asset.id);
      }, 520);
      return;
    }
    // Last photo: the whole post floats up and fades — "saved". It's removed
    // just before the fade ends (it's ~6% opaque by then), so the posts below
    // start closing the gap without a frame of empty black.
    lift.value = withDelay(320, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    setTimeout(() => onLiked(asset.id), 320 + 180);
  }

  function dislike(asset: AssetMeta) {
    if (leaving.current.has(asset.id)) return;
    leaving.current.add(asset.id);
    // The feed removes the photo in the same render that mounts its flying
    // copy, so there's never a frame without either (no black flash)
    photoRef.current?.measureInWindow((x, y, width, h) => onDislike(asset, { x, y, width, height: h }));
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
    opacity: 1 - lift.value,
    transform: [{ translateY: -24 * lift.value }, { scale: 1 + 0.03 * lift.value }],
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
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
        <IconWell icon={place ? 'pin' : 'calendar'} color={place ? 'sky' : 'blue'} size={34} />
        <View className="flex-1">
          <Text className="text-fg text-[16px] font-bold" numberOfLines={1}>
            {name}
          </Text>
          {subtitle && (
            <Text className="text-fg-2 text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="More" hitSlop={8} className="w-9 h-9 items-center justify-center">
          <Icon name="ellipsis" size={20} color={t.text.primary} />
        </Pressable>
      </View>

      {/* Photo — edge to edge; a paged carousel for Similar groups */}
      <GestureDetector gesture={doubleTap}>
        <View ref={photoRef} collapsable={false} style={{ width: W, height }} className="bg-track">
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
            <View className="absolute top-3 right-3 px-2 py-1 rounded-full bg-chip" pointerEvents="none">
              <Text className="text-chip-fg text-[12px] font-bold">
                {Math.min(page, assets.length - 1) + 1}/{assets.length}
              </Text>
            </View>
          )}
          {current.mediaType === 'video' && (
            <View className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-chip items-center justify-center" pointerEvents="none">
              <Icon name="play" size={15} color={t.photoChip.text} />
            </View>
          )}
          {multi && (
            <View
              className="absolute bottom-2.5 self-center flex-row gap-1 px-2 py-1.5 rounded-full bg-chip"
              pointerEvents="none"
            >
              {assets.map((a, i) => (
                <View
                  key={a.id}
                  className="w-1.5 h-1.5 rounded-full bg-chip-fg"
                  style={{ opacity: i === Math.min(page, assets.length - 1) ? 1 : 0.4 }}
                />
              ))}
            </View>
          )}
          <Animated.View className="absolute inset-0 items-center justify-center" pointerEvents="none" style={burstStyle}>
            <Icon name="heart" size={96} color={t.keep.icon} fill={t.keep.icon} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Action row, labeled: Keep · Delete … bookmark */}
      <View className="flex-row items-center px-2 h-[48px] gap-3.5">
        <Pressable
          onPress={() => like(current)}
          accessibilityRole="button"
          accessibilityLabel="Keep"
          hitSlop={6}
          className="flex-row items-center gap-1.5 h-11 px-1 active:opacity-60"
        >
          <Animated.View style={popStyle}>
            <Icon name="heart" size={23} color={t.keep.icon} fill={likedNow ? t.keep.icon : undefined} />
          </Animated.View>
          <Text className={`text-[15px] font-semibold ${likedNow ? 'text-keep-text' : 'text-fg'}`}>Keep</Text>
        </Pressable>
        <Pressable
          onPress={() => dislike(current)}
          accessibilityRole="button"
          accessibilityLabel="Delete — move to Trash"
          hitSlop={6}
          className="flex-row items-center gap-1.5 h-11 px-1 active:opacity-60"
        >
          <Icon name="trash" size={22} color={t.remove.icon} />
          <Text className="text-fg text-[15px] font-semibold">Delete</Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable
          onPress={() => onToggleFavorite(current.id)}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Remove from Favorites in Photos' : 'Add to Favorites in Photos'}
          className="w-11 h-11 items-center justify-center active:opacity-60"
        >
          <Icon name="bookmark" size={23} color={ON_PHOTO.text} fill={isFav ? ON_PHOTO.text : undefined} />
        </Pressable>
      </View>
    </Animated.View>
  );
});
