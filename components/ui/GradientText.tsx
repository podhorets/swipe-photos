import React from 'react';
import { Platform } from 'react-native';
import {
  Canvas,
  Text as SkiaText,
  LinearGradient,
  vec,
  matchFont,
} from '@shopify/react-native-skia';

interface GradientTextProps {
  text: string;
  fontSize: number;
  width: number; // canvas width — text is centered within it
  colors: readonly [string, string];
}

const fontFamily = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });

/**
 * Horizontal-gradient display text (Skia). Used for the hero freed-storage
 * number on the session-complete screen. Falls back gracefully: if the font
 * fails to resolve, Skia renders nothing — callers should keep the layout
 * stable via the fixed width/height.
 */
export function GradientText({ text, fontSize, width, colors }: GradientTextProps) {
  const font = matchFont({
    fontFamily,
    fontSize,
    fontWeight: 'bold',
  });

  const height = Math.ceil(fontSize * 1.25);
  const textWidth = font.measureText(text).width;
  const x = Math.max(0, (width - textWidth) / 2);
  const y = fontSize; // baseline

  return (
    <Canvas style={{ width, height }}>
      <SkiaText x={x} y={y} text={text} font={font}>
        <LinearGradient start={vec(x, 0)} end={vec(x + textWidth, height)} colors={[...colors]} />
      </SkiaText>
    </Canvas>
  );
}
