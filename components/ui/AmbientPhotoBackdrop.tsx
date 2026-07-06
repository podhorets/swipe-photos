import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Blurred ambient echo of the current review photo. Two stacked layers
 * cross-fade over 200ms when the uri changes; the fade runs on the UI thread
 * and the layer is non-interactive, so the swipe pipeline is untouched.
 */
export function AmbientPhotoBackdrop({ uri }: { uri?: string }) {
  const [pair, setPair] = useState<{ base?: string; top?: string }>({ top: uri });
  const topOpacity = useSharedValue(1);

  useEffect(() => {
    setPair((p) => (p.top === uri ? p : { base: p.top, top: uri }));
  }, [uri]);

  useEffect(() => {
    if (!pair.base) return;
    topOpacity.value = 0;
    topOpacity.value = withTiming(1, { duration: 200 });
  }, [pair, topOpacity]);

  const topStyle = useAnimatedStyle(() => ({ opacity: topOpacity.value }));

  return (
    <View
      pointerEvents="none"
      className="absolute overflow-hidden"
      style={{ top: -40, left: -40, right: -40, bottom: -40, opacity: 0.7 }}
    >
      {pair.base && (
        <Image
          source={{ uri: pair.base }}
          style={FILL}
          contentFit="cover"
          blurRadius={50}
          transition={0}
          priority="low"
          recyclingKey={pair.base}
        />
      )}
      {pair.top && (
        <AnimatedImage
          source={{ uri: pair.top }}
          style={[FILL, topStyle]}
          contentFit="cover"
          blurRadius={50}
          transition={0}
          priority="low"
          recyclingKey={pair.top}
        />
      )}
      {/* approximates the mock's brightness(0.4) over the blurred photo */}
      <View className="absolute inset-0 bg-black/45" />
    </View>
  );
}
