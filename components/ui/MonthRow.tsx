import { Pressable, View, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useSpringPress } from '@/hooks/useSpringPress';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface MonthRowProps {
  monthKey: string;    // 'YYYY-MM'
  label: string;       // 'April 2026'
  count: number;
  progress: number;    // 0–1, ratio of kept to total
  isComplete: boolean;
  coverUri?: string;
  /** Replaces the "N items" line (place rows show photos left and the date) */
  subtitle?: string;
  onPress: () => void;
}

export function MonthRow({ label, count, progress, isComplete, coverUri, subtitle, onPress }: MonthRowProps) {
  const t = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress();

  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  const pct = Math.round(progress * 100);

  return (
    <Animated.View style={animatedStyle} className="mb-[9px]">
      <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Card className="min-h-[81px] pl-2.5 pr-3 py-2.5 flex-row items-center gap-3">
          {/* Photo thumbnail */}
          <View className="w-[60px] h-[60px] rounded-xl overflow-hidden bg-track">
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
            <Text className="text-fg font-bold text-[15.5px]">{label}</Text>
            <Text className="text-fg-2 text-[13.5px] mt-0.5">{subtitle ?? `${count.toLocaleString()} items`}</Text>
          </View>

          {/* Right badge: done check or progress ring */}
          {isComplete ? (
            <View
              className="w-8 h-8 rounded-full items-center justify-center bg-keep-tint border-[3px] border-keep-ring"
              accessibilityLabel="Reviewed"
            >
              <Icon name="check" size={14} color={t.keep.icon} strokeWidth={3} />
            </View>
          ) : (
            <ProgressRing size={32} radius={14.5} strokeWidth={3} progress={progress}>
              <Text
                className={`text-[8.5px] font-bold ${pct > 0 ? 'text-fg' : 'text-fg-2'}`}
                accessibilityLabel={`${pct} percent reviewed`}
              >
                {pct}%
              </Text>
            </ProgressRing>
          )}
        </Card>
      </Pressable>
    </Animated.View>
  );
}
