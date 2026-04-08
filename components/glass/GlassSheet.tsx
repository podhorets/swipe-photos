import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, GLASS, RADIUS, SPACING } from '@/constants/theme';

interface GlassSheetProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  withSafeArea?: boolean;
}

/**
 * Bottom-anchored glass panel, typically used for action sheets and session-complete overlays.
 */
export function GlassSheet({
  children,
  style,
  intensity = GLASS.intensity.heavy,
  withSafeArea = true,
}: GlassSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      style={[
        styles.container,
        {
          paddingBottom: withSafeArea ? insets.bottom + SPACING.md : SPACING.md,
        },
        style,
      ]}
    >
      {/* Drag handle */}
      <View style={styles.handle} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.glass.border,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.glass.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
});
