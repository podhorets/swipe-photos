import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { useSpringPress } from '@/hooks/useSpringPress';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface SwipeActionButtonProps {
  type: 'delete' | 'keep';
  onPress: () => void;
}

/** 62pt keep / delete circle under the swipe card: 2pt ring on a soft tint. */
export function SwipeActionButton({ type, onPress }: SwipeActionButtonProps) {
  const t = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress(0.9);
  const isDelete = type === 'delete';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={isDelete ? 'Delete' : 'Keep'}
        className={`w-[62px] h-[62px] rounded-full items-center justify-center border-2 ${
          isDelete ? 'bg-del-tint border-del-ring' : 'bg-keep-tint border-keep-ring'
        }`}
      >
        <Icon name={isDelete ? 'trash' : 'heart'} size={24} color={isDelete ? t.remove.icon : t.keep.icon} />
      </Pressable>
    </Animated.View>
  );
}
