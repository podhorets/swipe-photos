import React, { useEffect, useMemo, useState } from 'react';
import { Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { usePlanStore } from '@/stores/planStore';
import { formatCountdown, isPro, msUntilMidnight, sessionsRemaining } from '@/lib/planUtils';

/** Free-plan sessions pill for the Home header: "N left" or refill countdown. */
export function SessionsChip() {
  const plan = usePlanStore((s) => s.plan);
  const sessionsUsedToday = usePlanStore((s) => s.sessionsUsedToday);
  const quotaDate = usePlanStore((s) => s.quotaDate);
  const mockPro = usePlanStore((s) => s.mockPro);

  const state = useMemo(
    () => ({ plan, sessionsUsedToday, quotaDate, mockPro }),
    [plan, sessionsUsedToday, quotaDate, mockPro],
  );

  const [now, setNow] = useState(() => new Date());
  const remaining = sessionsRemaining(state, now);

  // Tick only while exhausted: drives the countdown and the midnight refill
  useEffect(() => {
    if (remaining > 0) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [remaining]);

  if (isPro(state)) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/paywall', params: { context: 'chip' } })}
      accessibilityRole="button"
      accessibilityLabel={remaining > 0 ? `${remaining} free sessions left today` : 'Free sessions refill soon'}
      className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full bg-[rgba(10,132,255,0.15)] border border-[rgba(10,132,255,0.3)]"
    >
      <Text className="text-[13px]">{remaining > 0 ? '⚡' : '⏳'}</Text>
      <Text className="text-accent text-sm font-bold">
        {remaining > 0 ? `${remaining} left` : formatCountdown(msUntilMidnight(now))}
      </Text>
    </Pressable>
  );
}
