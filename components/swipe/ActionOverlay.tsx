import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SWIPE } from '@/constants/theme';

interface ActionOverlayProps {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

export function ActionOverlay({ translateX, translateY }: ActionOverlayProps) {
  // DELETE overlay (swipe left)
  const deleteStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE.thresholdPx, -SWIPE.thresholdPx * 0.3],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [-SWIPE.thresholdPx, -SWIPE.thresholdPx * 0.6],
      [1.1, 0.8],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  // KEEP overlay (swipe right)
  const keepStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [SWIPE.thresholdPx * 0.3, SWIPE.thresholdPx],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [SWIPE.thresholdPx * 0.6, SWIPE.thresholdPx],
      [0.8, 1.1],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  // FAVORITE overlay (swipe up)
  const favoriteStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [-SWIPE.upThresholdPx, -SWIPE.upThresholdPx * 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateY.value,
      [-SWIPE.upThresholdPx, -SWIPE.upThresholdPx * 0.6],
      [1.1, 0.8],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  return (
    <>
      {/* DELETE — left side tint */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: COLORS.delete.tint }, deleteStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Ionicons name="trash-outline" size={48} color="white" />
          <Text className="text-white font-bold text-2xl tracking-widest">DELETE</Text>
        </View>
      </Animated.View>

      {/* KEEP — right side tint */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: COLORS.keep.tint }, keepStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Ionicons name="checkmark-circle-outline" size={48} color="white" />
          <Text className="text-white font-bold text-2xl tracking-widest">KEEP</Text>
        </View>
      </Animated.View>

      {/* FAVORITE — up tint */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: COLORS.favorite.tint }, favoriteStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Ionicons name="heart" size={48} color="white" />
          <Text className="text-white font-bold text-2xl tracking-widest">FAVORITE</Text>
        </View>
      </Animated.View>
    </>
  );
}
