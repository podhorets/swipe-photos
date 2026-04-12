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
  progress?: number;   // 0–1, shown as progress bar + percentage
  isComplete?: boolean; // when true: show checkmark badge instead of count
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

export function CategoryCard({
  label,
  icon,
  count,
  subtitle,
  progress,
  isComplete = false,
  disabled = false,
  loading = false,
  onPress,
}: CategoryCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress();

  function handlePress() {
    if (!disabled) Haptics.selectionAsync();
    onPress();
  }

  const showProgress = progress !== undefined && progress > 0;
  const pct = showProgress ? Math.round(progress * 100) : 0;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
      >
        <GlassCard className={`mb-3 ${disabled ? 'opacity-40' : ''}`}>
          <View className="p-4">
            <View className="flex-row items-center gap-4">
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

              {/* Right badge */}
              {loading ? (
                <SkeletonTile width={52} height={24} borderRadius={12} />
              ) : isComplete ? (
                <View className="flex-row items-center gap-1.5">
                  <View className="w-6 h-6 rounded-full bg-green-500/80 items-center justify-center">
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                  <Text className="text-green-400 text-xs font-semibold">Done</Text>
                </View>
              ) : !disabled ? (
                <View className="flex-row items-center gap-2">
                  {showProgress && (
                    <Text className="text-white/50 text-xs font-semibold">{pct}%</Text>
                  )}
                  <View className="bg-white/15 rounded-full px-2.5 py-1">
                    <Text className="text-white text-xs font-semibold">
                      {count > 9999 ? '9999+' : count.toLocaleString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
              ) : null}
            </View>

            {/* Progress bar — only when progress > 0 and not complete */}
            {showProgress && !isComplete && (
              <View className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <View
                  className="h-full rounded-full bg-green-500/70"
                  style={{ width: `${pct}%` }}
                />
              </View>
            )}
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
