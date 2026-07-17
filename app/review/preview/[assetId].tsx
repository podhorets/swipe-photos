import { View, Dimensions, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Keeps the underlay's decode target at thumbnail size (~76pt), the only size
// class guaranteed locally for iCloud-offloaded originals
const UNDERLAY_SCALE = Math.ceil(Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) / 76);

/** Full-screen photo preview — no zoom, just look and close. */
export default function PreviewScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const asset = index.find((a) => a.id === assetId);

  return (
    <View className="flex-1 bg-black">
      {/* Blurred thumbnail-decode underlay: always locally available, even for
          iCloud-offloaded originals whose full-size may never load — without
          it the preview is a black screen. Same screen-aspect box scaled up,
          so the contain letterboxing matches the sharp layer. */}
      <View
        style={{
          position: 'absolute',
          width: SCREEN_WIDTH / UNDERLAY_SCALE,
          height: SCREEN_HEIGHT / UNDERLAY_SCALE,
          transform: [{ scale: UNDERLAY_SCALE }],
          transformOrigin: 'top left',
        }}
      >
        <Image
          source={{ uri: asset?.uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          blurRadius={2}
        />
      </View>
      <Image
        source={{ uri: asset?.uri }}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
        contentFit="contain"
        transition={120}
      />

      {/* Close button */}
      <View
        className="absolute right-4"
        style={{ top: insets.top + 12 }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
          className="w-10 h-10 rounded-full bg-black/50 items-center justify-center border border-white/20"
        >
          <Ionicons name="close" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );
}
