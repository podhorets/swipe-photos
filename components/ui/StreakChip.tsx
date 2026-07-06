import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useStreakStore } from '@/stores/streakStore';
import { computeStreak } from '@/lib/streakUtils';

/** 🔥 streak pill for the Home header. */
export function StreakChip() {
  const completedDates = useStreakStore((s) => s.completedDates);
  const streak = useMemo(() => computeStreak(completedDates, new Date()), [completedDates]);

  return (
    <View className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full bg-[rgba(255,159,10,0.15)] border border-[rgba(255,159,10,0.3)]">
      <Text className="text-[15px]">🔥</Text>
      <Text className="text-streak text-sm font-bold">{streak}</Text>
    </View>
  );
}
