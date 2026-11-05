import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { IconWell } from '@/components/ui/IconWell';
import { usePlanStore } from '@/stores/planStore';
import { formatCountdown, isPro, msUntilMidnight, sessionsRemaining } from '@/lib/planUtils';
import { FREE_PLAN } from '@/constants/config';
import { SPRING } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One notch of the segmented fuel gauge. Fill springs out when spent. */
function Segment({ lit }: { lit: boolean }) {
    const p = useSharedValue(lit ? 1 : 0);
    useEffect(() => {
        // Overdamped promote spring: lands the "1 left" beat without wobble
        p.value = withSpring(lit ? 1 : 0, SPRING.promote);
    }, [lit, p]);
    const fillStyle = useAnimatedStyle(() => ({
        opacity: p.value,
        transform: [{ scaleX: p.value }],
    }));
    return (
        <View className="flex-1 h-1 rounded-full bg-track overflow-hidden">
            <Animated.View className="h-full rounded-full bg-accent" style={[{ transformOrigin: 'left' }, fillStyle]} />
        </View>
    );
}

/** Inline "FREE" chip — the word that must pop. */
function FreeBadge() {
    return (
        <View className="rounded-md bg-tint px-1.5 py-px">
            <Text className="text-on-tint text-[11px] font-extrabold tracking-wide">FREE</Text>
        </View>
    );
}

/**
 * Free-plan sessions fuel gauge — full-width block for the Home screen
 * (own slot under the header). Replaces the old SessionsChip pill.
 *
 * States: segmented accent meter while reviews remain; exhausted shows an
 * amber hourglass with a live h:mm:ss countdown and a bar showing time elapsed toward the
 * midnight refill (it visibly refills overnight). Tap anywhere → paywall.
 * Pro users render nothing.
 */
export function SessionsMeter() {
    const t = useTheme();
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
    const exhausted = remaining <= 0;

    // Tick only while exhausted: drives the h:mm:ss countdown and the midnight refill
    useEffect(() => {
        if (!exhausted) return;
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, [exhausted]);

    if (isPro(state)) return null;

    const msLeft = msUntilMidnight(now);
    const countdown = formatCountdown(msLeft);
    // Exhausted bar = time elapsed toward refill, so it refills overnight
    const refillProgress = Math.min(1, Math.max(0, 1 - msLeft / DAY_MS));

    const a11yLabel = exhausted
        ? `Free reviews used up. ${countdown} until they refill. Tap to go unlimited.`
        : `${remaining} free ${remaining === 1 ? 'review' : 'reviews'} left today. Tap to go unlimited.`;

    return (
        <Pressable
            onPress={() => router.push({ pathname: '/paywall', params: { context: 'chip' } })}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            className="active:opacity-80"
        >
            <View
                className="flex-row items-center gap-3 rounded-2xl px-3 py-3 min-h-[72px] bg-card border border-tint"
                style={{ boxShadow: t.shadow.card }}
            >
                <IconWell icon={exhausted ? 'hourglass' : 'bolt'} color={exhausted ? 'amber' : 'blue'} size={38} />

                <View className="flex-1 gap-1">
                    {/* Title line */}
                    {exhausted ? (
                        <View className="flex-row flex-wrap items-center gap-[4px]">
                            <Text className="text-streak-fg text-[15px] font-extrabold" style={{ fontVariant: ['tabular-nums'] }}>
                                {countdown}
                            </Text>
                            <Text className="text-fg text-[14px] font-bold">left to start</Text>
                            <FreeBadge />
                            <Text className="text-fg text-[14px] font-bold">review</Text>
                        </View>
                    ) : (
                        <View className="flex-row items-center gap-[5px]">
                            <Text className="text-fg text-[16px] font-bold">{remaining}</Text>
                            <FreeBadge />
                            <Text className="text-fg text-[16px] font-bold">
                                {remaining === 1 ? 'review left' : 'reviews left'}
                            </Text>
                        </View>
                    )}

                    {/* Progress: segmented fuel gauge / refilling bar */}
                    {exhausted ? (
                        <View className="h-1 rounded-full bg-track overflow-hidden">
                            <View className="h-full rounded-full bg-accent" style={{ width: `${refillProgress * 100}%` }} />
                        </View>
                    ) : (
                        <View className="flex-row gap-[5px]">
                            {Array.from({ length: FREE_PLAN.sessionsPerDay }, (_, i) => (
                                <Segment key={i} lit={i < remaining} />
                            ))}
                        </View>
                    )}

                    {/* Upsell microcopy */}
                    <Text className="text-fg-2 text-[11.5px]">
                        {exhausted ? 'Skip the wait · ' : 'Refills at midnight · '}
                        <Text className="text-link font-bold">Go unlimited</Text>
                    </Text>
                </View>

                <Icon name="chevron" size={14} color={t.text.secondary} strokeWidth={2.4} />
            </View>
        </Pressable>
    );
}
