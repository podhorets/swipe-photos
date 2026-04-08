import { View, Dimensions, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGalleryStore } from '@/stores/galleryStore';
import { SPRING } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function PreviewScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const insets = useSafeAreaInsets();
  const index = useGalleryStore((s) => s.index);
  const asset = index.find((a) => a.id === assetId);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * e.scale),
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < MIN_SCALE + 0.1) {
        scale.value = withSpring(MIN_SCALE, SPRING.snappy);
        translateX.value = withSpring(0, SPRING.snappy);
        translateY.value = withSpring(0, SPRING.snappy);
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .enabled(true)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > MIN_SCALE + 0.1) {
        // Reset zoom
        scale.value = withSpring(MIN_SCALE, SPRING.snappy);
        translateX.value = withSpring(0, SPRING.snappy);
        translateY.value = withSpring(0, SPRING.snappy);
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2.5×
        scale.value = withSpring(2.5, SPRING.snappy);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan);
  const withDoubleTap = Gesture.Exclusive(doubleTap, composed);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View className="flex-1 bg-black">
      <GestureDetector gesture={withDoubleTap}>
        <Animated.View style={[{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, imageStyle]}>
          <Image
            source={{ uri: asset?.uri }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            contentFit="contain"
          />
        </Animated.View>
      </GestureDetector>

      {/* Close button */}
      <View
        className="absolute right-4"
        style={{ top: insets.top + 12 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-black/50 items-center justify-center border border-white/20"
        >
          <Ionicons name="close" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );
}
