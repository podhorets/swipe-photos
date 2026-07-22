import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import type { DemoPhoto } from '@/constants/demoPhotos';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * Fills a demo card with its configured photo, over a gradient base.
 *
 * The gradient always renders underneath rather than as an either/or branch:
 * a remote link that is still downloading — or that failed — leaves the card
 * looking deliberate instead of blank. expo-image resolves a bundled `require`
 * (number) and an https string from the same `source` prop, so both slot forms
 * land here unchanged.
 */
export function DemoFill({
  photo,
  gradient,
  gradientOpacity = 1,
}: {
  photo: DemoPhoto;
  gradient: readonly [string, string];
  gradientOpacity?: number;
}) {
  return (
    <View className="flex-1">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[FILL, { opacity: gradientOpacity }]}
      />
      {photo != null && <Image source={photo} contentFit="cover" transition={220} style={FILL} />}
    </View>
  );
}
