import React, { useEffect } from 'react';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlyingPhotoProps {
  uri: string;
  from: Rect;
  /** Center of the trash icon, in window coordinates */
  to: { x: number; y: number };
  onArrive: () => void;
}

const DURATION = 520;
// Size of the photo when it reaches the icon
const END_SIZE = 26;

/**
 * A disliked photo's copy that shrinks and glides into the Trash icon.
 * Rendered above the whole screen (the feed list clips its own content).
 */
export function FlyingPhoto({ uri, from, to, onArrive }: FlyingPhotoProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.bezier(0.45, 0, 0.2, 1) }, (done) => {
      if (done) scheduleOnRN(onArrive);
    });
  }, []);

  const dx = to.x - (from.x + from.width / 2);
  const dy = to.y - (from.y + from.height / 2);
  const endScale = END_SIZE / Math.max(from.width, from.height);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.75, 1], [1, 0.9, 0]),
    borderRadius: interpolate(progress.value, [0, 1], [0, Math.max(from.width, from.height) / 2]),
    transform: [
      { translateX: dx * progress.value },
      // A slight upward arc reads as "tossed", not "dragged"
      { translateY: dy * progress.value - Math.sin(progress.value * Math.PI) * 40 },
      { scale: interpolate(progress.value, [0, 1], [1, endScale]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute overflow-hidden"
      style={[{ left: from.x, top: from.y, width: from.width, height: from.height }, style]}
    >
      <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" />
    </Animated.View>
  );
}
