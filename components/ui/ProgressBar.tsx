import { View, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProgressBarProps {
  progress: number; // 0–1
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const barStyle = useAnimatedStyle(() => ({
    width: withTiming(progress * (SCREEN_WIDTH - 48), {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  return (
    <View className="h-1 bg-white/10 rounded-full mx-6 overflow-hidden">
      <Animated.View className="h-full bg-white rounded-full" style={barStyle} />
    </View>
  );
}
