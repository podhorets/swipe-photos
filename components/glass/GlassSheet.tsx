import React from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS } from '@/constants/theme';

interface GlassSheetProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  withSafeArea?: boolean;
}

/**
 * Bottom-anchored glass panel for action sheets and session-complete overlays.
 */
export function GlassSheet({
  children,
  className = '',
  intensity = GLASS.intensity.heavy,
  withSafeArea = true,
}: GlassSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      className={`rounded-t-4xl overflow-hidden border-t border-l border-r border-white/20 pt-2 px-6 ${className}`}
      style={{ paddingBottom: withSafeArea ? insets.bottom + 16 : 16 }}
    >
      {/* Drag handle */}
      <View className="w-9 h-1 rounded-full bg-white/20 self-center mb-4" />
      {children}
    </BlurView>
  );
}
