import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ON_PHOTO } from '@/constants/colors';
import { SWIPE } from '@/constants/theme';

interface ActionOverlayProps {
  translateX: SharedValue<number>;
  sizeLabel?: string;
}

const T = SWIPE.thresholdPx;

export function ActionOverlay({ translateX, sizeLabel }: ActionOverlayProps) {

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

  return (
    <>
      {/* DELETE */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: ON_PHOTO.deleteOverlay }, deleteOverlayStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Animated.View style={deleteIconStyle}>
            <Icon name="trash" size={48} color={ON_PHOTO.text} strokeWidth={1.8} />
          </Animated.View>
          <Animated.Text
            className="text-on-photo font-bold text-2xl tracking-widest"
            style={deleteLabelStyle}
          >
            DELETE
          </Animated.Text>
          {sizeLabel && (
            <Animated.Text className="text-on-photo-2 text-sm mt-1" style={deleteLabelStyle}>
              {sizeLabel}
            </Animated.Text>
          )}
        </View>
      </Animated.View>

      {/* KEEP */}
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={[{ backgroundColor: ON_PHOTO.keepOverlay }, keepOverlayStyle]}
        pointerEvents="none"
      >
        <View className="items-center gap-2">
          <Animated.View style={keepIconStyle}>
            <Icon name="checkCircle" size={48} color={ON_PHOTO.text} strokeWidth={1.8} />
          </Animated.View>
          <Animated.Text
            className="text-on-photo font-bold text-2xl tracking-widest"
            style={keepLabelStyle}
          >
            KEEP
          </Animated.Text>
        </View>
      </Animated.View>
    </>
  );
}
