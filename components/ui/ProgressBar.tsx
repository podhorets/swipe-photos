import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface ProgressBarProps {
  progress: number; // 0–1
  /** 3pt on review screens, 4pt elsewhere */
  thin?: boolean;
  className?: string;
}

/** Accent fill on a track, easing to each new value. */
export function ProgressBar({ progress, thin = false, className = 'mx-5' }: ProgressBarProps) {
  const trackWidth = useSharedValue(0);
  const clamped = Math.min(1, Math.max(0, progress));

  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming(clamped * trackWidth.value, { duration: 300, easing: Easing.out(Easing.cubic) }),
  }));

  return (
    <View
      className={`${thin ? 'h-[3px]' : 'h-1'} bg-track rounded-full overflow-hidden ${className}`}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View className="h-full rounded-full bg-accent" style={fillStyle} />
    </View>
  );
}
