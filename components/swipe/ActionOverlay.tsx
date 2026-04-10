import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SWIPE } from '@/constants/theme';

interface ActionOverlayProps {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const T = SWIPE.thresholdPx;
const U = SWIPE.upThresholdPx;

export function ActionOverlay({ translateX, translateY }: ActionOverlayProps) {

  // ── DELETE (swipe left) ────────────────────────────────────────────────────
  const deleteOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-T, -T * 0.3], [1, 0], Extrapolation.CLAMP),
  }));

  const deleteIconStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(translateX.value, [-T, -T * 0.6], [1.15, 0.8], Extrapolation.CLAMP),
    }],
  }));

  const deleteLabelStyle = useAnimatedStyle(() => ({
    transform: [{
      // Pumps from 0.8 → 1.15 as drag crosses the threshold
      scale: interpolate(
        translateX.value,
        [-T, -T * 0.8, 0],
        [1.15, 0.8, 0.8],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  // ── KEEP (swipe right) ─────────────────────────────────────────────────────
  const keepOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [T * 0.3, T], [0, 1], Extrapolation.CLAMP),
  }));

  const keepIconStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(translateX.value, [T * 0.6, T], [0.8, 1.15], Extrapolation.CLAMP),
    }],
  }));

  const keepLabelStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(
        translateX.value,
        [0, T * 0.8, T],
        [0.8, 0.8, 1.15],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  // ── FAVORITE (swipe up) ────────────────────────────────────────────────────
  const favoriteOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-U, -U * 0.4], [1, 0], Extrapolation.CLAMP),
  }));

  const favoriteIconStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(translateY.value, [-U, -U * 0.6], [1.15, 0.8], Extrapolation.CLAMP),
    }],
  }));

  const favoriteLabelStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(
        translateY.value,
        [-U, -U * 0.8, 0],
        [1.15, 0.8, 0.8],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  return (
    <>
      {/* DELETE */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: COLORS.delete.tint }, deleteOverlayStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Animated.View style={deleteIconStyle}>
            <Ionicons name="trash-outline" size={48} color="white" />
          </Animated.View>
          <Animated.Text
            className="text-white font-bold text-2xl tracking-widest"
            style={deleteLabelStyle}
          >
            DELETE
          </Animated.Text>
        </View>
      </Animated.View>

      {/* KEEP */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: COLORS.keep.tint }, keepOverlayStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Animated.View style={keepIconStyle}>
            <Ionicons name="checkmark-circle-outline" size={48} color="white" />
          </Animated.View>
          <Animated.Text
            className="text-white font-bold text-2xl tracking-widest"
            style={keepLabelStyle}
          >
            KEEP
          </Animated.Text>
        </View>
      </Animated.View>

      {/* FAVORITE */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: COLORS.favorite.tint }, favoriteOverlayStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Animated.View style={favoriteIconStyle}>
            <Ionicons name="heart" size={48} color="white" />
          </Animated.View>
          <Animated.Text
            className="text-white font-bold text-2xl tracking-widest"
            style={favoriteLabelStyle}
          >
            FAVORITE
          </Animated.Text>
        </View>
      </Animated.View>
    </>
  );
}
