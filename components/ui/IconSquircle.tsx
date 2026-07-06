import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

interface IconSquircleProps {
  icon: keyof typeof Ionicons.glyphMap;
  colors?: readonly [string, string]; // 135deg gradient
  bg?: string; // flat background (e.g. info row)
  size?: number;
  radius?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

/** Gradient icon squircle — 30×30 r9 in settings rows, 46×46 r15 on Home. */
export function IconSquircle({
  icon,
  colors,
  bg = 'rgba(255,255,255,0.14)',
  size = 30,
  radius = 9,
  iconSize = 16,
  style,
}: IconSquircleProps) {
  const inner = <Ionicons name={icon} size={iconSize} color="#FFFFFF" />;
  // className is not registered for expo-linear-gradient — centering via style
  const box = {
    width: size,
    height: size,
    borderRadius: radius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (colors) {
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[box, style]}
      >
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View style={[box, { backgroundColor: bg }, style]}>
      {inner}
    </View>
  );
}
