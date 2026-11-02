import React, { useEffect, useRef } from 'react';
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
  /** The copy is on screen over the card — the card can go now */
  onReady: () => void;
  onArrive: () => void;
}

const DURATION = 460;
// Size of the photo when it reaches the icon
const END_SIZE = 26;
// Start anyway if the image never reports it's displayed (e.g. not cached)
const READY_FALLBACK_MS = 150;

/**
 * A disliked photo's copy that shrinks and drops into the Trash icon.
 * Rendered above the whole screen (the feed list clips its own content).
 * It sits exactly over the card until its image is on screen, so swapping
 * the card for the copy never shows an empty frame.
 */
export function FlyingPhoto({ uri, from, to, onReady, onArrive }: FlyingPhotoProps) {
  const progress = useSharedValue(0);
  const started = useRef(false);

  function start() {
    if (started.current) return;
    started.current = true;
    onReady();
    // Ease-in: it leaves gently and speeds up into the bin, so the arrival
    // (and the icon's bump) lands right when the photo disappears
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) scheduleOnRN(onArrive);
    });
  }

  useEffect(() => {
    const t = setTimeout(start, READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  const dx = to.x - (from.x + from.width / 2);
  const dy = to.y - (from.y + from.height / 2);
  const endScale = END_SIZE / Math.max(from.width, from.height);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.85, 1], [1, 1, 0]),
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
      <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" priority="high" onDisplay={start} />
    </Animated.View>
  );
}
