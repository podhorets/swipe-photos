import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useStreakStore } from '@/stores/streakStore';
import { computeStreak } from '@/lib/streakUtils';
import { useTheme } from '@/lib/theme/ThemeProvider';

/** Flame + streak count pill for the Home header. */
export function StreakChip() {
  const t = useTheme();
  const completedDates = useStreakStore((s) => s.completedDates);
  const streak = useMemo(() => computeStreak(completedDates, new Date()), [completedDates]);

  return (
    <View
      className="flex-row items-center gap-1.5 min-h-[32px] px-3 rounded-full bg-streak-bg border border-hairline"
      accessibilityLabel={`${streak} day streak`}
    >
      <Icon name="flame" size={16} color={t.streak.text} fill={t.streak.flame} strokeWidth={1.8} />
      <Text className="text-streak-fg text-[14px] font-bold">{streak}</Text>
    </View>
  );
}
