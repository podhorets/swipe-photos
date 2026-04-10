import { Pressable, View, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { GlassCard } from '@/components/glass/GlassCard';
import { SkeletonTile } from '@/components/ui/SkeletonTile';
import { useSpringPress } from '@/hooks/useSpringPress';
import type { Category } from '@/types';

interface CategoryCardProps {
  id: Category;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  count: number;
  subtitle?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

export function CategoryCard({
  label,
  icon,
  count,
  subtitle,
  disabled = false,
  loading = false,
  onPress,
}: CategoryCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress();

  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
      >
        <GlassCard className={`mb-3 ${disabled ? 'opacity-40' : ''}`}>
          <View className="flex-row items-center p-4 gap-4">
            {/* Icon */}
            <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
              <Ionicons name={icon} size={24} color="white" />
            </View>

            {/* Labels */}
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">{label}</Text>
              {subtitle ? (
                <Text className="text-white/50 text-sm mt-0.5">{subtitle}</Text>
              ) : (
                <Text className="text-white/50 text-sm mt-0.5">
                  {disabled ? 'None' : `${count.toLocaleString()} items`}
                </Text>
              )}
            </View>

            {/* Count badge + chevron */}
            {loading ? (
              <SkeletonTile width={52} height={24} borderRadius={12} />
            ) : !disabled ? (
              <View className="flex-row items-center gap-2">
                <View className="bg-white/15 rounded-full px-2.5 py-1">
                  <Text className="text-white text-xs font-semibold">
                    {count > 9999 ? '9999+' : count.toLocaleString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
              </View>
            ) : null}
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
