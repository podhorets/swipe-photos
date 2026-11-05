import React, { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  size: number;
  radius: number;
  strokeWidth: number;
  progress: number; // 0–1
  trackColor?: string; // defaults to the theme track
  gradientColors?: readonly [string, string];
  color?: string; // solid stroke (defaults to accent); ignored when gradientColors is set
  /** Ease duration in ms. Shorten it for sources that tick faster than 800ms. */
  duration?: number;
  children?: React.ReactNode; // absolutely-centered content
}

/**
 * Animated progress ring — stroke-dashoffset eases out over 800ms on mount
 * and on progress changes (per design spec).
 */
export function ProgressRing({
  size,
  radius,
  strokeWidth,
  progress,
  trackColor,
  gradientColors,
  color,
  duration = 800,
  children,
}: ProgressRingProps) {
  const t = useTheme();
  const gradientId = useId();
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, animated, duration]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  const center = size / 2;
  const stroke = gradientColors ? `url(#${gradientId})` : color ?? t.accent.primary;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {gradientColors && (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradientColors[0]} />
              <Stop offset="1" stopColor={gradientColors[1]} />
            </LinearGradient>
          </Defs>
        )}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor ?? t.track}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">{children}</View>
    </View>
  );
}
