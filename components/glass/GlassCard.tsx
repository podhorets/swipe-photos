import React from 'react';
import { View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GLASS } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  intensity?: number;
  // When true, renders a plain View fallback (e.g. nested inside another BlurView)
  noBlur?: boolean;
}

export function GlassCard({
  children,
  className = '',
  style,
  intensity = GLASS.intensity.medium,
  noBlur = false,
}: GlassCardProps) {
  if (noBlur) {
    return (
      <View
        className={`rounded-3xl overflow-hidden border border-white/20 ${className}`}
        style={style}
      >
        <View className="bg-white/10 border-t border-white/30">{children}</View>
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      className={`rounded-3xl overflow-hidden border border-white/20 ${className}`}
      style={style}
    >
      {/* Inner top highlight */}
      <View className="border-t border-white/30">{children}</View>
    </BlurView>
  );
}
