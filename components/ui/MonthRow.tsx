import { Pressable, View, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { GlassCard } from '@/components/glass/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useSpringPress } from '@/hooks/useSpringPress';

interface MonthRowProps {
  monthKey: string;    // 'YYYY-MM'
  label: string;       // 'April 2026'
  count: number;
  progress: number;    // 0–1, ratio of kept to total
  isComplete: boolean;
  coverUri?: string;
  onPress: () => void;
}

export function MonthRow({ label, count, progress, isComplete, coverUri, onPress }: MonthRowProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress();

  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  const pct = Math.round(progress * 100);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <GlassCard noBlur radius={24} className="mb-2.5">
          <View className="p-3 flex-row items-center gap-3.5">
            {/* Photo thumbnail */}
            <View className="w-[62px] h-[62px] rounded-2xl overflow-hidden bg-white/10">
              {coverUri && (
                <Image
                  source={{ uri: coverUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  recyclingKey={coverUri}
                  transition={100}
                />
              )}
            </View>

            {/* Labels */}
            <View className="flex-1">
              <Text className="text-white font-bold text-base" style={{ letterSpacing: -0.2 }}>
                {label}
              </Text>
              <Text className="text-white/45 text-[13px] mt-0.5">
                {count.toLocaleString()} items
              </Text>
            </View>

            {/* Right badge: done check or progress ring */}
            {isComplete ? (
              <View
                className="w-[30px] h-[30px] rounded-full items-center justify-center mr-1"
                style={{
                  backgroundColor: 'rgba(48,209,88,0.18)',
                  borderWidth: 1.5,
                  borderColor: 'rgba(48,209,88,0.6)',
                }}
              >
                <Ionicons name="checkmark" size={15} color="#30D158" />
              </View>
            ) : (
              <View className="mr-1">
                <ProgressRing
                  size={34}
                  radius={14}
                  strokeWidth={3.5}
                  progress={progress}
                  trackColor="rgba(255,255,255,0.12)"
                >
                  <Text className="text-white/70 text-[9.5px] font-bold">{pct}</Text>
                </ProgressRing>
              </View>
            )}
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}
