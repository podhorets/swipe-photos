import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlanStore } from '@/stores/planStore';
import { formatCountdown, isPro, msUntilMidnight, sessionsRemaining } from '@/lib/planUtils';
import { FREE_PLAN } from '@/constants/config';
import { GRADIENTS, SPRING } from '@/constants/theme';

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
        <View className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <Animated.View className="h-full rounded-full overflow-hidden" style={[{ transformOrigin: 'left' }, fillStyle]}>
                <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            </Animated.View>
        </View>
    );
}

/** Inline "FREE" badge — the word that must pop. Black text on amber (badge convention). */
function FreeBadge({ amber }: { amber: boolean }) {
    return (
        <View className="rounded-md overflow-hidden">
            <LinearGradient
                colors={amber ? GRADIENTS.star : GRADIENTS.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingHorizontal: 6, paddingVertical: 1 }}
            >
                <Text className={amber ? 'text-black text-[11px] font-extrabold tracking-wide' : 'text-white text-[11px] font-extrabold tracking-wide'}>
                    FREE
                </Text>
            </LinearGradient>
        </View>
    );
}

/**
 * Free-plan sessions fuel gauge — full-width block for the Home screen
 * (own slot under the header). Replaces the old SessionsChip pill.
 *
 * States: segmented blue meter while reviews remain; exhausted flips to amber
 * with a live h:mm:ss countdown and a bar showing time elapsed toward the
 * midnight refill (it visibly refills overnight). Tap anywhere → paywall.
 * Pro users render nothing.
 */
export function SessionsMeter() {
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
            className="active:opacity-80 mb-3"
        >
            <View
                className={
                    exhausted
                        ? 'flex-row items-center gap-3 rounded-[22px] px-3.5 py-3 bg-[rgba(255,159,10,0.10)] border border-[rgba(255,159,10,0.3)]'
                        : 'flex-row items-center gap-3 rounded-[22px] px-3.5 py-3 bg-[rgba(10,132,255,0.10)] border border-[rgba(10,132,255,0.28)]'
                }
                style={{ borderTopColor: 'rgba(255,255,255,0.28)' }}
            >
                {/* Icon squircle */}
                <View
                    className="rounded-[13px] overflow-hidden"
                    style={
                        exhausted
                            ? { shadowColor: '#FF9F0A', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }
                            : { shadowColor: '#0A84FF', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }
                    }
                >
                    <LinearGradient
                        colors={exhausted ? GRADIENTS.star : GRADIENTS.accent}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name={exhausted ? 'hourglass' : 'flash'} size={20} color={exhausted ? 'black' : 'white'} />
                    </LinearGradient>
                </View>

                <View className="flex-1">
                    {/* Title line */}
                    {exhausted ? (
                        <View className="flex-row flex-wrap items-center gap-[4px]">
                            <Text className="text-streak text-[15px] font-extrabold" style={{ fontVariant: ['tabular-nums'] }}>
                                {countdown}
                            </Text>
                            <Text className="text-white text-[14px] font-bold">to start new</Text>
                            <FreeBadge amber />
                            <Text className="text-white text-[14px] font-bold">review</Text>
                        </View>
                    ) : (
                        <View className="flex-row items-center gap-[5px]">
                            <Text className="text-white text-[16px] font-extrabold">{remaining}</Text>
                            <FreeBadge amber={false} />
                            <Text className="text-white text-[16px] font-extrabold">
                                {remaining === 1 ? 'review left' : 'reviews left'}
                            </Text>
                        </View>
                    )}

                    {/* Progress: segmented fuel gauge / refilling amber bar */}
                    {exhausted ? (
                        <View className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                            <View className="h-full rounded-full overflow-hidden" style={{ width: `${refillProgress * 100}%` }}>
                                <LinearGradient colors={GRADIENTS.star} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                            </View>
                        </View>
                    ) : (
                        <View className="flex-row gap-1.5 mt-2">
                            {Array.from({ length: FREE_PLAN.sessionsPerDay }, (_, i) => (
                                <Segment key={i} lit={i < remaining} />
                            ))}
                        </View>
                    )}

                    {/* Upsell microcopy */}
                    <View className="flex-row items-center gap-1 mt-[7px]">
                        <Text className="text-white/45 text-[12px]">
                            {exhausted ? 'Skip the wait · ' : 'Refills at midnight · '}
                        </Text>
                        <Text className={exhausted ? 'text-streak text-[12px] font-semibold' : 'text-accent text-[12px] font-semibold'}>
                            Go unlimited
                        </Text>
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            </View>
        </Pressable>
    );
}
