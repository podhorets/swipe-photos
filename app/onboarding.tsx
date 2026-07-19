import { useEffect, useState } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedReaction,
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    withRepeat,
    interpolate,
    Extrapolation,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { createMMKV } from 'react-native-mmkv';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/glass/GlassCard';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { usePermissions } from '@/hooks/usePermissions';
import { gatedHaptic } from '@/lib/haptics';
import { STORAGE_KEYS } from '@/constants/config';
import { GRADIENTS, SPRING } from '@/constants/theme';
import { posthog } from '@/lib/posthog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const storage = createMMKV();

// ─── Step 1 hero: auto-playing swipe demo ────────────────────────────────────
// A card stack that swipes itself — left with the DELETE overlay, right with
// KEEP — on a 6s loop. Pure UI-thread transforms; the same ActionOverlay
// interpolation curves as the real SwipeCard, so onboarding *is* the product.

const DEMO_W = 190;
const DEMO_H = 254;
const DEMO_FLY = SCREEN_WIDTH; // fully off the hero viewport
const DEMO_DRAG = 48; // "hesitation" drag distance before commit

function SwipeDemo({ active }: { active: boolean }) {
    const x = useSharedValue(0);

    useEffect(() => {
        x.value = 0;
        x.value = withRepeat(
            withSequence(
                // pause → drag left → fly off → (invisible) teleport back
                withDelay(700, withTiming(-DEMO_DRAG, { duration: 450, easing: Easing.out(Easing.quad) })),
                withTiming(-DEMO_FLY, { duration: 320, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 1 }),
                // pause → drag right → fly off → teleport back
                withDelay(900, withTiming(DEMO_DRAG, { duration: 450, easing: Easing.out(Easing.quad) })),
                withTiming(DEMO_FLY, { duration: 320, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 1 }),
                withDelay(900, withTiming(0, { duration: 1 })),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(x);
    }, [x]);

    // Haptic beat when the demo card "commits" — only while this step is visible
    useAnimatedReaction(
        () => x.value,
        (cur, prev) => {
            if (!active || prev === null) return;
            const th = DEMO_DRAG - 4;
            if ((prev > -th && cur <= -th) || (prev < th && cur >= th)) {
                scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Medium);
            }
        },
        [active],
    );

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: x.value },
            {
                rotate: `${interpolate(x.value, [-DEMO_FLY, 0, DEMO_FLY], [-0.28, 0, 0.28], Extrapolation.CLAMP)}rad`,
            },
        ],
        // fade just before the off-screen teleport so the reset is invisible
        opacity: interpolate(
            Math.abs(x.value),
            [0, DEMO_FLY * 0.6, DEMO_FLY * 0.85],
            [1, 1, 0],
            Extrapolation.CLAMP,
        ),
    }));

    const deleteOverlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(x.value, [-DEMO_DRAG, -DEMO_DRAG * 0.35], [1, 0], Extrapolation.CLAMP),
    }));
    const keepOverlayStyle = useAnimatedStyle(() => ({
        opacity: interpolate(x.value, [DEMO_DRAG * 0.35, DEMO_DRAG], [0, 1], Extrapolation.CLAMP),
    }));

    return (
        <View className="items-center">
            <View
                className="items-center justify-center overflow-hidden"
                style={{ width: 280, height: DEMO_H + 36 }}
            >
                {/* Back card */}
                <LinearGradient
                    colors={GRADIENTS.analytics}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        position: 'absolute',
                        width: DEMO_W,
                        height: DEMO_H,
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.25)',
                        transform: [{ scale: 0.94 }, { translateY: 12 }],
                        opacity: 0.8,
                    }}
                />
                {/* Auto-swiping top card */}
                <Animated.View
                    className="absolute overflow-hidden"
                    style={[
                        {
                            width: DEMO_W,
                            height: DEMO_H,
                            borderRadius: 22,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.35)',
                            shadowColor: '#000',
                            shadowOpacity: 0.5,
                            shadowRadius: 24,
                            shadowOffset: { width: 0, height: 16 },
                        },
                        cardStyle,
                    ]}
                >
                    <LinearGradient
                        colors={GRADIENTS.accent}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1 }}
                    />
                    <Animated.View
                        className="absolute inset-0 items-center justify-center gap-1.5"
                        style={[{ backgroundColor: 'rgba(255,69,58,0.82)' }, deleteOverlayStyle]}
                        pointerEvents="none"
                    >
                        <Ionicons name="trash-outline" size={40} color="white" />
                        <Text className="text-white font-bold text-[19px] tracking-widest">DELETE</Text>
                    </Animated.View>
                    <Animated.View
                        className="absolute inset-0 items-center justify-center gap-1.5"
                        style={[{ backgroundColor: 'rgba(48,209,88,0.82)' }, keepOverlayStyle]}
                        pointerEvents="none"
                    >
                        <Ionicons name="checkmark-circle-outline" size={40} color="white" />
                        <Text className="text-white font-bold text-[19px] tracking-widest">KEEP</Text>
                    </Animated.View>
                </Animated.View>
            </View>
            {/* Legend chips */}
            <View className="flex-row gap-2.5 mt-1">
                <View
                    className="px-3.5 py-[7px] rounded-full border"
                    style={{ backgroundColor: 'rgba(255,69,58,0.14)', borderColor: 'rgba(255,69,58,0.4)' }}
                >
                    <Text className="text-[13px] font-semibold" style={{ color: '#FF6482' }}>← Delete</Text>
                </View>
                <View
                    className="px-3.5 py-[7px] rounded-full border"
                    style={{ backgroundColor: 'rgba(48,209,88,0.14)', borderColor: 'rgba(48,209,88,0.4)' }}
                >
                    <Text className="text-keep text-[13px] font-semibold">Keep →</Text>
                </View>
            </View>
        </View>
    );
}

// ─── Step 2 hero: AI dedup demo ──────────────────────────────────────────────
// Three near-duplicate thumbnails collapse into the starred "best" card; a
// freed-space chip pops in. One progress shared value drives every element.

const THUMB = 56;
const THUMB_GRADIENTS = [GRADIENTS.accent, GRADIENTS.shield, GRADIENTS.analytics] as const;
// Each thumb converges on the hero card's center
const THUMB_TX = [64, 0, -64];

function DedupDemo({ active }: { active: boolean }) {
    const p = useSharedValue(0);

    useEffect(() => {
        p.value = 0;
        p.value = withRepeat(
            withSequence(
                withDelay(900, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) })),
                withDelay(1800, withTiming(0, { duration: 350 })),
                withDelay(400, withTiming(0, { duration: 1 })),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(p);
    }, [p]);

    // Success beat when the group collapses
    useAnimatedReaction(
        () => p.value,
        (cur, prev) => {
            if (!active || prev === null) return;
            if (prev < 0.7 && cur >= 0.7) {
                scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Light);
            }
        },
        [active],
    );

    const thumbStyle = (i: number) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useAnimatedStyle(() => {
            const t = interpolate(p.value, [0.15 + i * 0.06, 0.65 + i * 0.06], [0, 1], Extrapolation.CLAMP);
            return {
                opacity: 1 - t,
                transform: [
                    { translateX: t * THUMB_TX[i] },
                    { translateY: t * -120 },
                    { scale: 1 - t * 0.85 },
                ],
            };
        });
    const thumb0 = thumbStyle(0);
    const thumb1 = thumbStyle(1);
    const thumb2 = thumbStyle(2);

    const starStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(p.value, [0.55, 0.8, 1], [0, 1.18, 1], Extrapolation.CLAMP) },
        ],
    }));
    const chipStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0.7, 1], [0, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(p.value, [0.7, 1], [10, 0], Extrapolation.CLAMP) },
        ],
    }));

    return (
        <View className="items-center">
            {/* Hero — the kept "best" shot */}
            <View
                className="overflow-hidden"
                style={{
                    width: 180,
                    height: 220,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.35)',
                    shadowColor: '#000',
                    shadowOpacity: 0.5,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 16 },
                }}
            >
                <LinearGradient
                    colors={GRADIENTS.shield}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                />
                <Animated.View
                    className="absolute top-2.5 left-2.5 flex-row items-center gap-1.5 px-[11px] py-1.5 rounded-full bg-black/55"
                    style={starStyle}
                >
                    <Ionicons name="star" size={12} color="#FFD60A" />
                    <Text className="text-white text-xs font-bold">Best</Text>
                </Animated.View>
            </View>
            {/* Near-duplicate thumbnails that sweep into the hero */}
            <View className="flex-row gap-2.5 mt-3.5">
                {[thumb0, thumb1, thumb2].map((style, i) => (
                    <Animated.View
                        key={i}
                        className="overflow-hidden"
                        style={[
                            {
                                width: THUMB,
                                height: THUMB,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: 'rgba(255,69,58,0.45)',
                            },
                            style,
                        ]}
                    >
                        <LinearGradient
                            colors={THUMB_GRADIENTS[i]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1, opacity: 0.8 }}
                        />
                    </Animated.View>
                ))}
            </View>
            {/* Freed-space payoff chip */}
            <Animated.View
                className="flex-row items-center gap-[7px] mt-3.5 px-4 py-2 rounded-full border"
                style={[
                    { backgroundColor: 'rgba(48,209,88,0.14)', borderColor: 'rgba(48,209,88,0.4)' },
                    chipStyle,
                ]}
            >
                <Ionicons name="trash-outline" size={13} color="#30D158" />
                <Text className="text-keep text-[13px] font-bold">3 deleted · 14 MB freed</Text>
            </Animated.View>
        </View>
    );
}

// ─── Step 3 hero: trust + proof card (permission priming) ───────────────────

const TRUST_ROWS = [
    {
        gradient: GRADIENTS.freed,
        icon: 'phone-portrait-outline' as const,
        title: '100% on-device',
        sub: 'No uploads. No accounts. No cloud.',
    },
    {
        gradient: GRADIENTS.star,
        icon: 'star' as const,
        title: '4.8 ★★★★★', // TODO: keep in sync with real App Store rating
        sub: 'Millions of photos cleaned',
    },
    {
        gradient: GRADIENTS.delete,
        icon: 'arrow-undo-outline' as const,
        title: 'Nothing is deleted without you',
        sub: '30-day recovery via Recently Deleted',
    },
];

function TrustCard() {
    return (
        <GlassCard className="w-full" style={{ marginTop: 28 }}>
            <View className="px-5 py-[18px] gap-3.5">
                {TRUST_ROWS.map((row, i) => (
                    <View key={row.title} className="gap-3.5">
                        {i > 0 && <View className="h-px bg-white/10" />}
                        <View className="flex-row items-center gap-3">
                            <LinearGradient
                                colors={row.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Ionicons name={row.icon} size={18} color="white" />
                            </LinearGradient>
                            <View className="flex-1 gap-0.5">
                                <Text className="text-white text-[15px] font-semibold">{row.title}</Text>
                                <Text className="text-white/55 text-[13px]">{row.sub}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </GlassCard>
    );
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
    {
        title: 'Left deletes.\nRight keeps.',
        subtitle: "Breeze through hundreds of photos a minute. It's oddly satisfying.",
    },
    {
        title: 'Gigabytes hide\nin duplicates',
        subtitle:
            'On-device AI finds look-alike bursts, stars the sharpest shot, and deletes the rest in one tap.',
    },
    {
        title: 'See what your\nlibrary is hiding',
        subtitle:
            "We scan your photos on your iPhone — nothing ever leaves your device — and show what's safe to delete.",
    },
];

export default function OnboardingScreen() {
    const insets = useSafeAreaInsets();
    const { isMediaGranted, requestMedia, requestNotifications } = usePermissions();

    const [currentStep, setCurrentStep] = useState(0);
    const slideOffset = useSharedValue(0);

    useEffect(() => {
        posthog.capture('onboarding_step_viewed', { step: currentStep });
    }, [currentStep]);

    const slideStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: -slideOffset.value * SCREEN_WIDTH }],
    }));

    const isLastStep = currentStep === STEPS.length - 1;

    function goNext() {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const next = currentStep + 1;
        setCurrentStep(next);
        slideOffset.value = withSpring(next, SPRING.modal);
    }

    async function handleFinish() {
        if (!isMediaGranted) {
            const result = await requestMedia();
            if (!result?.granted) return;
        }
        // Notifications optional — don't block on denial
        await requestNotifications();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        storage.set(STORAGE_KEYS.hasCompletedOnboarding, true);
        posthog.capture('onboarding_completed');
        router.replace('/(tabs)');
    }

    function handleSkip() {
        posthog.capture('onboarding_skipped', { step: currentStep });
        router.replace('/(tabs)');
    }

    return (
        <View
            className="flex-1 bg-bg-dark"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            <AuroraBackground variant="onboarding" />

            {/* Slides */}
            <View className="flex-1 overflow-hidden">
                <Animated.View
                    className="flex-row flex-1"
                    style={[{ width: SCREEN_WIDTH * STEPS.length }, slideStyle]}
                >
                    {STEPS.map((s, i) => (
                        <View
                            key={i}
                            className="items-center justify-center px-8"
                            style={{ width: SCREEN_WIDTH }}
                        >
                            {/* Hero */}
                            {i === 0 && (
                                <View className="mb-8">
                                    <SwipeDemo active={currentStep === 0} />
                                </View>
                            )}
                            {i === 1 && (
                                <View className="mb-6">
                                    <DedupDemo active={currentStep === 1} />
                                </View>
                            )}
                            {i === 2 && (
                                <View
                                    className="items-center justify-center mb-7"
                                    style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 22,
                                        shadowColor: '#0A84FF',
                                        shadowOpacity: 0.35,
                                        shadowRadius: 28,
                                        shadowOffset: { width: 0, height: 10 },
                                    }}
                                >
                                    <LinearGradient
                                        colors={GRADIENTS.shield}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            borderRadius: 22,
                                        }}
                                    />
                                    <Ionicons name="lock-closed" size={32} color="white" />
                                </View>
                            )}

                            {/* Title */}
                            <Text
                                className="text-white font-extrabold text-center mb-4"
                                style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1 }}
                            >
                                {s.title}
                            </Text>

                            {/* Subtitle */}
                            <Text
                                className="text-white/55 text-[17px] text-center"
                                style={{ lineHeight: 26, maxWidth: 310 }}
                            >
                                {s.subtitle}
                            </Text>

                            {/* Trust + proof card next to the permission ask */}
                            {i === 2 && <TrustCard />}
                        </View>
                    ))}
                </Animated.View>
            </View>

            {/* Bottom controls */}
            <View className="px-8 pb-6 gap-[18px]">
                {/* Step dots */}
                <View className="flex-row justify-center items-center gap-2">
                    {STEPS.map((_, i) =>
                        i === currentStep ? (
                            <LinearGradient
                                key={i}
                                colors={GRADIENTS.accent}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ width: 26, height: 6, borderRadius: 999 }}
                            />
                        ) : (
                            <View key={i} className="w-1.5 h-1.5 rounded-full bg-white/25" />
                        ),
                    )}
                </View>

                {/* Primary CTA */}
                <GradientPillButton
                    label={isLastStep ? 'Allow Photo Access' : 'Continue'}
                    onPress={isLastStep ? handleFinish : goNext}
                />

                {/* Skip (last step only, visually quiet) */}
                {isLastStep && (
                    <Pressable onPress={handleSkip} className="items-center py-2">
                        <Text className="text-white/40 text-sm">Skip for now</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}
