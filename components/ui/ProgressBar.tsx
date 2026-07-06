import { View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GRADIENTS } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRACK_WIDTH = SCREEN_WIDTH - 40;

interface ProgressBarProps {
  progress: number; // 0–1
}

export function ProgressBar({ progress }: ProgressBarProps) {
  // Animated width clips a fixed full-width gradient so the gradient never stretches
  const clipStyle = useAnimatedStyle(() => ({
    width: withTiming(progress * TRACK_WIDTH, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  return (
    <View className="h-1 bg-white/[0.14] rounded-full mx-5 overflow-hidden">
      <Animated.View className="h-full rounded-full overflow-hidden" style={clipStyle}>
        <LinearGradient
          colors={GRADIENTS.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: TRACK_WIDTH, height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}
