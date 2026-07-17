import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

// Decode target that is always available locally — iOS keeps small thumbnails
// on-device even for iCloud-offloaded originals.
const THUMB_DECODE = 76;

interface ProgressivePhotoProps {
  uri: string;
  width: number;
  height: number;
}

/**
 * Photo that never renders as an empty box: a blurred thumbnail-sized decode
 * shows instantly underneath, and the full-size image fades in over it when
 * (if ever) its derivative becomes available. The scale transform lives on a
 * wrapper View — putting it on the Image itself inflates expo-image's decode
 * target and reproduces the blank-image failure.
 */
export function ProgressivePhoto({ uri, width, height }: ProgressivePhotoProps) {
  const scale = Math.ceil(Math.max(width, height) / THUMB_DECODE);
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <View
        style={{
          width: THUMB_DECODE,
          height: THUMB_DECODE,
          transform: [{ scale }],
          transformOrigin: 'top left',
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: THUMB_DECODE, height: THUMB_DECODE }}
          contentFit="cover"
          blurRadius={2}
        />
      </View>
      <Image
        source={{ uri }}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        contentFit="cover"
        transition={120}
      />
    </View>
  );
}
