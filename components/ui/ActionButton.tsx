import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSpringPress } from '@/hooks/useSpringPress';

interface ActionButtonProps {
  type: 'delete' | 'keep';
  onPress: () => void;
}

const SIZE = 64;

const CONFIG = {
  delete: {
    icon: 'trash' as const,
    label: 'Delete',
    bg: 'rgba(255,69,58,0.18)',
    border: 'rgba(255,69,58,0.5)',
    color: '#FF453A',
    glow: '#FF453A',
  },
  keep: {
    icon: 'heart' as const,
    label: 'Keep',
    bg: 'rgba(48,209,88,0.18)',
    border: 'rgba(48,209,88,0.5)',
    color: '#30D158',
    glow: '#30D158',
  },
};

export function ActionButton({ type, onPress }: ActionButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress(0.88);
  const cfg = CONFIG[type];

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          shadowColor: cfg.glow,
          shadowOpacity: 0.25,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 12 },
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={cfg.label}
        className="rounded-full items-center justify-center"
        style={{
          width: SIZE,
          height: SIZE,
          backgroundColor: cfg.bg,
          borderWidth: 1.5,
          borderColor: cfg.border,
        }}
      >
        <Ionicons name={cfg.icon} size={26} color={cfg.color} />
      </Pressable>
    </Animated.View>
  );
}
