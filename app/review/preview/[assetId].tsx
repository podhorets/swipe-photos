import { useCallback, useState } from 'react';
import { View, Dimensions, Pressable, Share, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useGalleryStore } from '@/stores/galleryStore';
import { SPRING, SWIPE } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Keeps the underlay's decode target at thumbnail size (~76pt), the only size
// class guaranteed locally for iCloud-offloaded originals
const UNDERLAY_SCALE = Math.ceil(Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) / 76);
// Drag distance at which the media reaches its smallest scale / the chrome is
// fully faded — both are progress ramps, not the dismiss threshold itself.
const SHRINK_DISTANCE = SCREEN_HEIGHT * 0.5;
const CHROME_FADE_DISTANCE = 90;

/** Round glass button used for the preview chrome. */
function ChromeButton({
  icon,
  label,
  onPress,
  busy = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-10 h-10 rounded-full bg-black/50 items-center justify-center border border-white/20 active:opacity-70"
    >
      {busy ? <ActivityIndicator size="small" color="white" /> : <Ionicons name={icon} size={20} color="white" />}
    </Pressable>
  );
}

/** Full-screen photo/video preview — no zoom, just look, share, and close. */
export default function PreviewScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const asset = index.find((a) => a.id === assetId);
  const isVideo = asset?.mediaType === 'video';
  const [preparing, setPreparing] = useState(false);

  // Opening a video preview is an explicit request to watch it: autoplay and
  // loop, with native controls for scrubbing. Photos pass null so no player is
  // allocated.
  const player = useVideoPlayer(isVideo ? (asset?.uri ?? null) : null, (p) => {
    p.loop = true;
    p.play();
  });

  const close = useCallback(() => router.back(), []);

  async function handleShare() {
    if (!asset || preparing) return;
    setPreparing(true);
    if (isVideo) player.pause();
    try {
      // A ph:// id means nothing to the share sheet — resolve the on-disk file
      // first. The default shouldDownloadFromNetwork pulls the original back
      // from iCloud if it was offloaded, which is why this can take a moment.
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);
      if (!info.localUri) throw new Error('no local file');
      await Share.share({ url: info.localUri });
    } catch {
      Alert.alert('Sharing failed', 'This item could not be prepared for sharing.');
    } finally {
      setPreparing(false);
      if (isVideo) player.play();
    }
  }

  // Drag anywhere on the media to dismiss, iOS-Photos style. Vertical-only
  // activation so a video's scrubber still gets its horizontal drags.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetY([-16, 16])
    .failOffsetX([-28, 28])
    .onUpdate((e) => {
      translateY.value = e.translationY;
      // X follows at a fraction — a rigid axis reads as a stuck gesture
      translateX.value = e.translationX * 0.4;
    })
    // `success` is false when the system cancels the gesture (an incoming call,
    // a native control claiming the touch) — snap back rather than dismiss.
    .onEnd((e, success) => {
      const far = Math.abs(e.translationY) > SWIPE.dismissThresholdPx;
      const fast = Math.abs(e.velocityY) > SWIPE.velocityThresholdY;
      if (success && (far || fast)) {
        runOnJS(close)();
        return;
      }
      translateX.value = withSpring(0, SPRING.snappy);
      translateY.value = withSpring(0, SPRING.snappy);
    });

  const mediaStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateY.value) / SHRINK_DISTANCE, 1);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: 1 - progress * 0.2 },
      ],
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(translateY.value) / CHROME_FADE_DISTANCE, 1),
  }));

  return (
    <View className="flex-1 bg-black">
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, mediaStyle]}>
          {isVideo ? (
            <VideoView
              player={player}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
              contentFit="contain"
              nativeControls
              // The preview already fills the screen; both extras would only add
              // buttons that fight the chrome for the same corners.
              allowsFullscreen={false}
              allowsPictureInPicture={false}
            />
          ) : (
            <>
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
            </>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Share left, close right — the video's own controls own the bottom edge */}
      <Animated.View
        pointerEvents="box-none"
        className="absolute left-4 right-4 flex-row items-center justify-between"
        style={[{ top: insets.top + 12 }, chromeStyle]}
      >
        <ChromeButton
          icon="share-outline"
          label="Share"
          onPress={handleShare}
          busy={preparing}
        />
        <ChromeButton icon="close" label="Close preview" onPress={close} />
      </Animated.View>
    </View>
  );
}
