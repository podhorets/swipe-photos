import { useMemo } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassCard } from '@/components/glass/GlassCard';
import { useStreakStore } from '@/stores/streakStore';
import { computeStreak, getWeekCompletions } from '@/lib/streakUtils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function StreakWidget() {
  const completedDates = useStreakStore((s) => s.completedDates);

  const { streak, weekCompletions } = useMemo(() => {
    const today = new Date();
    return {
      streak: computeStreak(completedDates, today),
      weekCompletions: getWeekCompletions(completedDates, today),
    };
  }, [completedDates]);

  const todayIndex = (() => {
    const day = new Date().getDay(); // 0=Sun … 6=Sat
    return day === 0 ? 6 : day - 1; // convert to Mon=0 … Sun=6
  })();

  return (
    <View className="mb-4">
      {/* Top row: streak card + placeholder card */}
      <View className="flex-row gap-3 mb-3">
        {/* Streak card */}
        <GlassCard className="flex-1">
          <View className="p-4 items-center justify-center" style={{ minHeight: 110 }}>
            <Text style={{ fontSize: 36 }}>🔥</Text>
            <Text className="text-white text-3xl font-bold mt-1">{streak}</Text>
            <Text className="text-white/50 text-sm mt-0.5">
              {streak === 1 ? 'Day' : 'Days'} Streak
            </Text>
          </View>
        </GlassCard>

        {/* Placeholder card */}
        <GlassCard className="flex-1">
          <View className="p-4 items-center justify-center" style={{ minHeight: 110 }}>
            <Ionicons name="stats-chart-outline" size={28} color="rgba(255,255,255,0.15)" />
            <Text className="text-white/25 text-sm mt-2 text-center">Coming soon</Text>
          </View>
        </GlassCard>
      </View>

      {/* Weekly checkmark row */}
      <GlassCard>
        <View className="flex-row justify-around px-2 py-3">
          {DAY_LABELS.map((label, i) => {
            const completed = weekCompletions[i];
            const isToday = i === todayIndex;
            return (
              <View key={label} className="items-center gap-1.5">
                <Text
                  className={`text-xs font-medium ${isToday ? 'text-white/70' : 'text-white/30'}`}
                >
                  {label}
                </Text>
                <View
                  className="w-7 h-7 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: completed
                      ? 'rgba(234,179,8,0.2)'
                      : isToday
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(255,255,255,0.04)',
                    borderWidth: isToday && !completed ? 1 : 0,
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}
                >
                  {completed && (
                    <Ionicons name="checkmark" size={14} color="#eab308" />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}
