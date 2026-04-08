import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { SPRING, GLASS } from '@/constants/theme';
import { SESSION } from '@/constants/config';

interface UndoPillProps {
  visible: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoPill({ visible, onUndo, onDismiss }: UndoPillProps) {
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING.modal);
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-dismiss after duration
      opacity.value = withDelay(
        SESSION.undoPillDuration,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        }),
      );
      translateY.value = withDelay(
        SESSION.undoPillDuration,
        withTiming(40, { duration: 300 }),
      );
    } else {
      translateY.value = withTiming(40, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, opacity, onDismiss]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="absolute bottom-4 self-center"
      style={pillStyle}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable onPress={onUndo}>
        <BlurView
          intensity={GLASS.intensity.heavy}
          tint={GLASS.tint}
          className="flex-row items-center gap-2 px-5 py-3 rounded-full overflow-hidden border border-white/20"
        >
          <Ionicons name="arrow-undo-outline" size={16} color="white" />
          <Text className="text-white font-semibold text-sm">Undo</Text>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}
