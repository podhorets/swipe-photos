import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, GLASS, RADIUS, SPACING } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  radius?: number;
  padding?: number;
  // When true, renders a plain View fallback (e.g. inside another BlurView)
  noBlur?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = GLASS.intensity.medium,
  radius = RADIUS.lg,
  padding = SPACING.md,
  noBlur = false,
}: GlassCardProps) {
  const containerStyle: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glass.border,
    // Drop shadow for depth
    shadowColor: COLORS.glass.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  };

  const innerStyle: ViewStyle = {
    padding,
    backgroundColor: noBlur ? COLORS.glass.light : undefined,
  };

  if (noBlur) {
    return (
      <View style={[containerStyle, style]}>
        <View style={innerStyle}>{children}</View>
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      style={[containerStyle, style]}
    >
      <View style={[styles.inner, innerStyle]}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  inner: {
    // Subtle inner highlight at top edge
    borderTopWidth: 1,
    borderTopColor: COLORS.glass.borderStrong,
  },
});
