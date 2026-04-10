import { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

interface SkeletonTileProps {
  width: number;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Shimmering skeleton placeholder.
 * A white highlight strip sweeps left→right continuously using Reanimated.
 * No external gradient library required.
 */
export function SkeletonTile({ width, height, borderRadius = 16, style }: SkeletonTileProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // 0 → 1, loops continuously (no reverse — sweep always left to right)
    progress.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [progress]);

  // Strip is 60% of width; travels from fully off-left to fully off-right
  const stripWidth = width * 0.6;

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-stripWidth, width + stripWidth],
        ),
      },
    ],
  }));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.07)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Shimmer strip: transparent → bright → transparent */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, width: stripWidth, flexDirection: 'row' },
          shimmerStyle,
        ]}
      >
        <View style={{ flex: 1 }} />
        <View style={{ flex: 2, backgroundColor: 'rgba(255,255,255,0.13)' }} />
        <View style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
