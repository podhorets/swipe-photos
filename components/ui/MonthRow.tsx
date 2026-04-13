import { Pressable, View, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { GlassCard } from '@/components/glass/GlassCard';
import { useSpringPress } from '@/hooks/useSpringPress';

interface MonthRowProps {
  monthKey: string;    // 'YYYY-MM'
  label: string;       // 'April 2026'
  count: number;
  progress: number;    // 0–1, ratio of kept to total
  isComplete: boolean;
  onPress: () => void;
}

export function MonthRow({ label, count, progress, isComplete, onPress }: MonthRowProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress();

  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  const showProgress = progress > 0;
  const pct = showProgress ? Math.round(progress * 100) : 0;
  const keptCount = showProgress ? Math.round(progress * count) : 0;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <GlassCard className="mb-3">
          <View className="p-4">
            <View className="flex-row items-center gap-4">
              {/* Icon */}
              <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center">
                <Ionicons name="calendar-number-outline" size={24} color="white" />
              </View>

              {/* Labels */}
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">{label}</Text>
                <Text className="text-white/50 text-sm mt-0.5">
                  {count.toLocaleString()} items
                </Text>
              </View>

              {/* Right badge */}
              {isComplete ? (
                <View className="flex-row items-center gap-1.5">
                  <View className="w-6 h-6 rounded-full bg-green-500/80 items-center justify-center">
                    <Ionicons name="checkmark" size={14} color="white" />
                  </View>
                  <Text className="text-green-400 text-xs font-semibold">Done</Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <View className="bg-white/15 rounded-full px-2.5 py-1">
                    <Text className="text-white text-xs font-semibold">
                      {count > 9999 ? '9999+' : count.toLocaleString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </View>

            {/* Progress bar — only when progress > 0 and not complete */}
            {showProgress && !isComplete && (
              <View className="mt-3">
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-white/40 text-xs">{keptCount}/{count} photos</Text>
                  <Text className="text-white/40 text-xs">{pct}%</Text>
                </View>
                <View className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <View
                    className="h-full rounded-full bg-green-500/70"
                    style={{ width: `${pct}%` }}
                  />
                </View>
              </View>
            )}
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
