import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GLASS } from '@/constants/theme';

interface BlurPanelProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

/**
 * Full-coverage blur background. Use as a backdrop for content layers.
 */
export function BlurPanel({
  children,
  style,
  intensity = GLASS.intensity.heavy,
}: BlurPanelProps) {
  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      style={[StyleSheet.absoluteFill, style]}
    >
      {children}
    </BlurView>
  );
}
