import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AURORA } from '@/constants/theme';

export type AuroraVariant =
  | 'default'
  | 'onboarding'
  | 'by-month'
  | 'settings'
  | 'trash'
  | 'success';

interface Blob {
  color: string;
  size: number;
  top: number;
  left?: number;
  right?: number;
  centered?: boolean;
}

// Positions/sizes from the design mock (docs/Swipe Photos.dc.html, section 1b)
const VARIANTS: Record<AuroraVariant, Blob[]> = {
  default: [
    { color: AURORA.violet, size: 460, top: -160, left: -100 },
    { color: AURORA.blue, size: 400, top: 200, right: -160 },
  ],
  onboarding: [
    { color: AURORA.violetStrong, size: 420, top: -140, left: -80 },
    { color: AURORA.blueStrong, size: 380, top: 120, right: -140 },
  ],
  'by-month': [{ color: 'rgba(10,132,255,0.22)', size: 440, top: -160, right: -100 }],
  settings: [{ color: 'rgba(94,92,230,0.22)', size: 420, top: -140, left: -120 }],
  trash: [{ color: AURORA.red, size: 420, top: -140, right: -120 }],
  success: [{ color: AURORA.green, size: 480, top: 80, centered: true }],
};

function GlowBlob({ blob, id }: { blob: Blob; id: string }) {
  const { color, size, top, left, right, centered } = blob;
  return (
    <View
      className="absolute"
      style={
        centered
          ? { top, left: '50%', marginLeft: -size / 2, width: size, height: size }
          : { top, left, right, width: size, height: size }
      }
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} />
            <Stop offset="0.65" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Ambient radial glow blobs behind screen content. Place as the first child
 * of a `bg-bg-dark` root; content renders above via default stacking.
 */
export function AuroraBackground({ variant = 'default' }: { variant?: AuroraVariant }) {
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
      {VARIANTS[variant].map((blob, i) => (
        <GlowBlob key={i} blob={blob} id={`aurora-${variant}-${i}`} />
      ))}
    </View>
  );
}
