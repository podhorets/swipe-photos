import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SPRING } from '@/constants/theme';

/**
 * Returns animated style + handlers for a springy press scale effect.
 * Use on any Pressable/TouchableOpacity via `style={[animatedStyle]}`.
 */
export function useSpringPress(scaleTo = 0.94) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function onPressIn() {
    scale.value = withSpring(scaleTo, SPRING.press);
  }

  function onPressOut() {
    scale.value = withSpring(1, SPRING.press);
  }

  return { animatedStyle, onPressIn, onPressOut };
}
