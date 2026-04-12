import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSpringPress } from '@/hooks/useSpringPress';

interface ActionButtonProps {
  type: 'delete' | 'keep';
  onPress: () => void;
}

const CONFIG = {
  delete: {
    icon: 'trash-outline' as const,
    label: 'Delete',
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    color: '#FF453A',
    size: 56,
  },
  keep: {
    icon: 'checkmark-outline' as const,
    label: 'Keep',
    bg: 'bg-green-500/20',
    border: 'border-green-500/40',
    color: '#30D158',
    size: 56,
  },
};

export function ActionButton({ type, onPress }: ActionButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress(0.88);
  const cfg = CONFIG[type];

  return (
    <Animated.View style={animatedStyle} className="items-center gap-1.5">
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`rounded-full border ${cfg.bg} ${cfg.border} items-center justify-center`}
        style={{ width: cfg.size, height: cfg.size }}
      >
        <Ionicons name={cfg.icon} size={cfg.size * 0.45} color={cfg.color} />
      </Pressable>
      <Text className="text-white/40 text-xs">{cfg.label}</Text>
    </Animated.View>
  );
}
