import React from 'react';
import { BlurView } from 'expo-blur';
import { GLASS } from '@/constants/theme';

interface BlurPanelProps {
  children?: React.ReactNode;
  className?: string;
  intensity?: number;
}

/**
 * Full-coverage blur background. Use as a backdrop for content layers.
 */
export function BlurPanel({
  children,
  className = '',
  intensity = GLASS.intensity.heavy,
}: BlurPanelProps) {
  return (
    <BlurView
      intensity={intensity}
      tint={GLASS.tint}
      className={`absolute inset-0 ${className}`}
    >
      {children}
    </BlurView>
  );
}
