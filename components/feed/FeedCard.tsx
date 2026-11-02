import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS, SCREEN, SPRING } from '@/constants/theme';
import type { AssetMeta } from '@/types';

// Instagram's range: 4:5 portrait down to a wide landscape
const MIN_RATIO = 0.6;
const MAX_RATIO = 1.25;

interface FeedCardProps {
  asset: AssetMeta;
  place: string | null;
  liked: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One feed post: place and date, the photo (double-tap to like), then like
 * and dislike. Dislike fades and shrinks the card before it leaves the feed.
 */
export const FeedCard = memo(function FeedCard({ asset, place, liked, onLike, onDislike }: FeedCardProps) {
  const ratio = Math.min(Math.max(asset.height / Math.max(asset.width, 1), MIN_RATIO), MAX_RATIO);
  const height = SCREEN.width * ratio;

  const burst = useSharedValue(0);
  const leave = useSharedValue(0);

  function like() {
    if (!liked) onLike(asset.id);
    burst.value = withSequence(withSpring(1, SPRING.snappy), withDelay(350, withTiming(0, { duration: 220 })));
  }

  function dislike() {
    // Gentle exit first; the feed drops the card once it has faded
    leave.value = withTiming(1, { duration: 260 }, (done) => {
      if (done) scheduleOnRN(onDislike, asset.id);
    });
  }

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(like);
    });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: 1 - leave.value,
    transform: [{ scale: 1 - leave.value * 0.06 }],
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.5 + burst.value * 0.7 }],
  }));

  return (
    <Animated.View style={cardStyle} className="mb-5">
      <View className="flex-row items-center justify-between px-4 mb-2">
        <View className="flex-row items-center gap-1.5 flex-1">
          {place && <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.7)" />}
          <Text className="text-white text-[14px] font-semibold" numberOfLines={1}>
            {place ?? formatDay(asset.creationTime)}
          </Text>
        </View>
        {place && <Text className="text-white/45 text-[12px]">{formatDay(asset.creationTime)}</Text>}
      </View>

      <GestureDetector gesture={doubleTap}>
        <View style={{ width: SCREEN.width, height }} className="bg-bg-card">
          <Image source={{ uri: asset.uri }} style={{ flex: 1 }} contentFit="cover" transition={150} recyclingKey={asset.id} />
          {asset.mediaType === 'video' && (
            <View className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 items-center justify-center">
              <Ionicons name="play" size={15} color="white" />
            </View>
          )}
          <Animated.View className="absolute inset-0 items-center justify-center" pointerEvents="none" style={burstStyle}>
            <Ionicons name="heart" size={96} color="white" />
          </Animated.View>
        </View>
      </GestureDetector>

      <View className="flex-row items-center px-2.5 pt-1.5">
        <Pressable
          onPress={() => (liked ? onLike(asset.id) : like())}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          className="w-11 h-11 items-center justify-center active:opacity-60"
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? COLORS.destructive : 'white'} />
        </Pressable>
        <Pressable
          onPress={dislike}
          accessibilityRole="button"
          accessibilityLabel="Dislike — move to Trash"
          className="w-11 h-11 items-center justify-center active:opacity-60"
        >
          <Ionicons name="thumbs-down-outline" size={25} color="white" />
        </Pressable>
      </View>
    </Animated.View>
  );
});
