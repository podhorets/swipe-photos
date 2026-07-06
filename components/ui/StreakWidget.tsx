import { useMemo } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassCard } from '@/components/glass/GlassCard';
import { useStreakStore } from '@/stores/streakStore';
import { getWeekCompletions } from '@/lib/streakUtils';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** "This week" strip — 7 day dots; complete = amber check, today = ring. */
export function StreakWidget() {
  const completedDates = useStreakStore((s) => s.completedDates);

  const weekCompletions = useMemo(
    () => getWeekCompletions(completedDates, new Date()),
    [completedDates],
  );

  const todayIndex = (() => {
    const day = new Date().getDay(); // 0=Sun … 6=Sat
    return day === 0 ? 6 : day - 1; // convert to Mon=0 … Sun=6
  })();

  return (
    <GlassCard noBlur radius={20} className="mb-4">
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <Text className="text-white/50 text-xs font-semibold">This week</Text>
        <View className="flex-row gap-2.5">
          {DAY_LETTERS.map((letter, i) => {
            const completed = weekCompletions[i];
            const isToday = i === todayIndex;
            return (
              <View key={i} className="items-center gap-1">
                <Text
                  className={`text-[10px] font-semibold ${
                    isToday ? 'text-white/80' : 'text-white/35'
                  }`}
                >
                  {letter}
                </Text>
                <View
                  className="w-[18px] h-[18px] rounded-full items-center justify-center"
                  style={{
                    backgroundColor: completed ? '#FF9F0A' : 'rgba(255,255,255,0.08)',
                    borderWidth: isToday && !completed ? 1.5 : 0,
                    borderColor: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {completed && <Ionicons name="checkmark" size={10} color="#050508" />}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </GlassCard>
  );
}
