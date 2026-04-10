import React, { useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  BlurMask,
} from '@shopify/react-native-skia';
import { GLASS, RADIUS } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  intensity?: number;
  // When true, renders a plain View fallback (e.g. nested inside another BlurView)
  noBlur?: boolean;
}

const CARD_RADIUS = RADIUS.lg; // 24 — matches rounded-3xl (1.5rem)

function SkiaBorderOverlay({ width, height }: { width: number; height: number }) {
  return (
    <Canvas
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {/* Gradient border: white top-left → transparent bottom-right */}
      <RoundedRect
        x={0.75}
        y={0.75}
        width={width - 1.5}
        height={height - 1.5}
        r={CARD_RADIUS}
        style="stroke"
        strokeWidth={1.5}
      >
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: width * 0.65, y: height }}
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.04)']}
        />
      </RoundedRect>

      {/* Inner glow: soft white halo around the perimeter */}
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height}
        r={CARD_RADIUS}
        color="rgba(255,255,255,0.06)"
      >
        <BlurMask blur={10} style="normal" />
      </RoundedRect>
    </Canvas>
  );
}

export function GlassCard({
  children,
  className = '',
  style,
  intensity = GLASS.intensity.medium,
  noBlur = false,
}: GlassCardProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const hasSize = width > 0 && height > 0;

  if (noBlur) {
    return (
      <View
        className={`rounded-3xl overflow-hidden ${className}`}
        style={style}
        onLayout={(e) => setSize(e.nativeEvent.layout)}
      >
        <View className="bg-white/10 border-t border-white/30">{children}</View>
        {hasSize && <SkiaBorderOverlay width={width} height={height} />}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      className={`rounded-3xl overflow-hidden ${className}`}
      style={style}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      <View className="border-t border-white/30">{children}</View>
      {hasSize && <SkiaBorderOverlay width={width} height={height} />}
    </BlurView>
  );
}
