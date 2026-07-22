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
    type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { createMMKV } from 'react-native-mmkv';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/glass/GlassCard';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { DemoFill } from '@/components/ui/DemoFill';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import {
    DEDUP_BEST_INDEX,
    DEDUP_DEMO_PHOTOS,
    SWIPE_DEMO_CARDS,
    type DemoPhoto,
    type SwipeDemoCard,
} from '@/constants/demoPhotos';
import { usePermissions } from '@/hooks/usePermissions';
import { gatedHaptic } from '@/lib/haptics';
import { STORAGE_KEYS } from '@/constants/config';
import { GRADIENTS, SPRING } from '@/constants/theme';
import { posthog } from '@/lib/posthog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const storage = createMMKV();

// Demo photos live in constants/demoPhotos.ts — onboarding runs BEFORE photo
// permission, so it can never show the user's own library. See that file for
// how to fill the six slots (bundled asset or https link).

// ─── Step 1 hero: auto-playing swipe demo ────────────────────────────────────
// A deck that swipes itself through SWIPE_DEMO_CARDS on a loop. Every card is
// mounted once with its own photo and derives its pose (hidden → back-of-deck
// → front → flown off) from one linear master clock, entirely on the UI
// thread. Photos NEVER change on a mounted Image — swapping `source` mid-view
// is what caused visible cross-fade/placeholder churn between swipes.

const DEMO_W = 190;
const DEMO_H = 254;
const DEMO_FLY = SCREEN_WIDTH; // fully off the hero viewport
const DEMO_DRAG = 48; // "hesitation" drag distance before commit
// Back-of-deck pose; the next card promotes out of it into the front pose
const DEMO_BACK_SCALE = 0.94;
const DEMO_BACK_Y = 12;
// One beat = one card's turn: settle in, rest, drag, fly off. The clock runs
// 0→N linearly (one unit per beat); each phase applies its own easing locally.
const BEAT_MS = 1470;
const F_SETTLE = 0.18; // by here the card has settled from back pose to front
const F_DRAG = 0.48; // rest ends, hesitation drag begins
const F_COMMIT = 0.78; // threshold crossed — fly-off begins
// Placeholder gradient per deck position, so unfilled slots stay distinguishable
const DECK_GRADIENTS = [GRADIENTS.accent, GRADIENTS.analytics, GRADIENTS.shield, GRADIENTS.freed] as const;

/** Front-card translateX over the beat — piecewise, eased per phase. */
function deckFrontX(u: number, dir: number): number {
    'worklet';
    if (u >= F_COMMIT) {
        const t = (u - F_COMMIT) / (1 - F_COMMIT);
        return dir * (DEMO_DRAG + (DEMO_FLY - DEMO_DRAG) * t * t);
    }
    if (u >= F_DRAG) {
        const t = (u - F_DRAG) / (F_COMMIT - F_DRAG);
        return dir * DEMO_DRAG * (1 - (1 - t) * (1 - t));
    }
    return 0;
}

function DeckCard({
    clock,
    index,
    card,
    total,
}: {
    clock: SharedValue<number>;
    index: number;
    card: SwipeDemoCard;
    total: number;
}) {
    const dir = card.decision === 'delete' ? -1 : 1;
    const isDelete = card.decision === 'delete';

    const cardStyle = useAnimatedStyle(() => {
        const beat = Math.floor(clock.value) % total;
        const u = clock.value - Math.floor(clock.value);

        if (beat === index) {
            // Front: settle in from the back pose, rest, drag, fly off.
            // Opacity starts at the back card's 0.8 so the promotion is seamless.
            const st = Math.min(u / F_SETTLE, 1);
            const settle = 1 - (1 - st) * (1 - st);
            const x = deckFrontX(u, dir);
            const flyFade = interpolate(
                Math.abs(x),
                [0, DEMO_FLY * 0.6, DEMO_FLY * 0.85],
                [1, 1, 0],
                Extrapolation.CLAMP,
            );
            return {
                zIndex: 2,
                opacity: flyFade * (0.8 + 0.2 * settle),
                transform: [
                    { translateX: x },
                    { translateY: DEMO_BACK_Y * (1 - settle) },
                    { scale: DEMO_BACK_SCALE + (1 - DEMO_BACK_SCALE) * settle },
                    { rotate: `${interpolate(x, [-DEMO_FLY, 0, DEMO_FLY], [-0.28, 0, 0.28], Extrapolation.CLAMP)}rad` },
                ],
            };
        }
        if ((beat + 1) % total === index) {
            // Back of deck: fade in behind the promoting front card (which starts
            // in this exact pose and covers the pop-in)
            return {
                zIndex: 1,
                opacity: interpolate(u, [0, 0.12], [0, 0.8], Extrapolation.CLAMP),
                transform: [
                    { translateX: 0 },
                    { translateY: DEMO_BACK_Y },
                    { scale: DEMO_BACK_SCALE },
                    { rotate: '0rad' },
                ],
            };
        }
        // Off duty — parked invisible in the back pose
        return {
            zIndex: 0,
            opacity: 0,
            transform: [
                { translateX: 0 },
                { translateY: DEMO_BACK_Y },
                { scale: DEMO_BACK_SCALE },
                { rotate: '0rad' },
            ],
        };
    });

    const overlayStyle = useAnimatedStyle(() => {
        const beat = Math.floor(clock.value) % total;
        if (beat !== index) return { opacity: 0 };
        const u = clock.value - Math.floor(clock.value);
        const ax = Math.abs(deckFrontX(u, dir));
        return {
            opacity: interpolate(ax, [DEMO_DRAG * 0.35, DEMO_DRAG], [0, 1], Extrapolation.CLAMP),
        };
    });

    return (
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
            <DemoFill photo={card.photo} gradient={DECK_GRADIENTS[index % DECK_GRADIENTS.length]} />
            {/* Only the overlay for this card's scripted decision */}
            <Animated.View
                className="absolute inset-0 items-center justify-center gap-1.5"
                style={[
                    { backgroundColor: isDelete ? 'rgba(255,69,58,0.82)' : 'rgba(48,209,88,0.82)' },
                    overlayStyle,
                ]}
                pointerEvents="none"
            >
                <Ionicons
                    name={isDelete ? 'trash-outline' : 'checkmark-circle-outline'}
                    size={40}
                    color="white"
                />
                <Text className="text-white font-bold text-[19px] tracking-widest">
                    {isDelete ? 'DELETE' : 'KEEP'}
                </Text>
            </Animated.View>
        </Animated.View>
    );
}

function SwipeDemo({ active }: { active: boolean }) {
    const clock = useSharedValue(0);
    const total = SWIPE_DEMO_CARDS.length;

    useEffect(() => {
        clock.value = 0;
        clock.value = withRepeat(
            withTiming(total, { duration: total * BEAT_MS, easing: Easing.linear }),
            -1,
            false,
        );
        return () => cancelAnimation(clock);
    }, [clock, total]);

    // Haptic beat at each commit — only while this step is visible
    useAnimatedReaction(
        () => clock.value % 1,
        (cur, prev) => {
            if (!active || prev === null) return;
            if (prev < F_COMMIT && cur >= F_COMMIT) {
                scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Medium);
            }
        },
        [active],
    );

    return (
        <View className="items-center">
            <View
                className="items-center justify-center overflow-hidden"
                style={{ width: 280, height: DEMO_H + 36 }}
            >
                {SWIPE_DEMO_CARDS.map((card, i) => (
                    <DeckCard key={i} clock={clock} index={i} card={card} total={total} />
                ))}
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
// Four takes of one scene. The main slot opens on photo 1; the take the
// analysis prefers (DEDUP_BEST_INDEX) pulses, then trades places with it — a
// simple cross-fade in both slots — and the Best badge lands on the new main
// shot. The moment it does, every thumbnail is marked for deletion (red wash +
// trash icon), which is what the freed-space chip then counts.

const THUMB = 56;
// Thumbnails render indices 1–3 of DEDUP_DEMO_PHOTOS, in order
const THUMB_INDICES = [1, 2, 3] as const;
// Quiet dark base behind every photo (and for any slot left null) — no loud
// gradients in this demo.
const DEDUP_EMPTY_BG = '#1C1C1E';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Photo over the flat dark base — the dedup demo never shows gradients. */
function DedupPhoto({ photo }: { photo: DemoPhoto }) {
    return (
        <View className="flex-1" style={{ backgroundColor: DEDUP_EMPTY_BG }}>
            {photo != null && <Image source={photo} contentFit="cover" transition={150} style={FILL} />}
        </View>
    );
}

function DedupDemo({ active }: { active: boolean }) {
    const p = useSharedValue(0);
    // Slot the winner currently occupies — it receives photo 1 in exchange
    const winnerSlot = THUMB_INDICES.indexOf(DEDUP_BEST_INDEX);

    useEffect(() => {
        p.value = 0;
        p.value = withRepeat(
            withSequence(
                withDelay(800, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) })),
                withDelay(1900, withTiming(0, { duration: 400 })),
                withDelay(500, withTiming(0, { duration: 1 })),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(p);
    }, [p]);

    // Success beat when the swap lands
    useAnimatedReaction(
        () => p.value,
        (cur, prev) => {
            if (!active || prev === null) return;
            if (prev < 0.6 && cur >= 0.6) {
                scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Light);
            }
        },
        [active],
    );

    // One ramp drives both halves of the exchange
    const swapStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0.3, 0.6], [0, 1], Extrapolation.CLAMP),
    }));
    const heroStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(p.value, [0.3, 0.45, 0.6], [1, 0.97, 1], Extrapolation.CLAMP) },
        ],
    }));
    // The winner is singled out first, then lifts as it trades up
    const winnerStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(p.value, [0.05, 0.28, 0.6], [1, 1.12, 1], Extrapolation.CLAMP) },
            { translateY: interpolate(p.value, [0.3, 0.45, 0.6], [0, -8, 0], Extrapolation.CLAMP) },
        ],
    }));
    const starStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(p.value, [0.6, 0.8, 0.95], [0, 1.18, 1], Extrapolation.CLAMP) },
        ],
    }));
    // The moment the Best badge lands, every thumbnail is marked for deletion —
    // winner slot included: it now holds photo 1, also a duplicate
    const trashWashStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0.6, 0.8], [0, 1], Extrapolation.CLAMP),
    }));
    const trashIconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(p.value, [0.6, 0.75, 0.85], [0.4, 1.12, 1], Extrapolation.CLAMP) },
        ],
    }));
    const chipStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0.75, 1], [0, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(p.value, [0.75, 1], [10, 0], Extrapolation.CLAMP) },
        ],
    }));

    return (
        <View className="items-center">
            {/* Main shot — opens on photo 1, cross-fades to the picked take */}
            <Animated.View
                className="overflow-hidden"
                style={[
                    {
                        width: 180,
                        height: 220,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.35)',
                        shadowColor: '#000',
                        shadowOpacity: 0.5,
                        shadowRadius: 24,
                        shadowOffset: { width: 0, height: 16 },
                    },
                    heroStyle,
                ]}
            >
                <DedupPhoto photo={DEDUP_DEMO_PHOTOS[0]} />
                <Animated.View style={[FILL, swapStyle]}>
                    <DedupPhoto photo={DEDUP_DEMO_PHOTOS[DEDUP_BEST_INDEX]} />
                </Animated.View>
                <Animated.View
                    className="absolute top-2.5 left-2.5 flex-row items-center gap-1.5 px-[11px] py-1.5 rounded-full bg-black/55"
                    style={starStyle}
                >
                    <Ionicons name="star" size={12} color="#FFD60A" />
                    <Text className="text-white text-xs font-bold">Best</Text>
                </Animated.View>
            </Animated.View>
            {/* The other three takes — the winner among them trades up */}
            <View className="flex-row gap-2.5 mt-3.5">
                {THUMB_INDICES.map((photoIndex, slot) => {
                    const isWinner = slot === winnerSlot;
                    return (
                        <Animated.View
                            key={photoIndex}
                            className="overflow-hidden"
                            style={[
                                {
                                    width: THUMB,
                                    height: THUMB,
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: 'rgba(255,69,58,0.45)',
                                },
                                isWinner ? winnerStyle : undefined,
                            ]}
                        >
                            {isWinner ? (
                                <>
                                    <DedupPhoto photo={DEDUP_DEMO_PHOTOS[DEDUP_BEST_INDEX]} />
                                    {/* Receives photo 1 as the main slot takes this one */}
                                    <Animated.View style={[FILL, swapStyle]}>
                                        <DedupPhoto photo={DEDUP_DEMO_PHOTOS[0]} />
                                    </Animated.View>
                                </>
                            ) : (
                                <DedupPhoto photo={DEDUP_DEMO_PHOTOS[photoIndex]} />
                            )}
                            {/* Marked-for-deletion wash once the Best badge lands */}
                            <Animated.View
                                pointerEvents="none"
                                className="items-center justify-center"
                                style={[FILL, { backgroundColor: 'rgba(255,69,58,0.38)' }, trashWashStyle]}
                            >
                                <Animated.View style={trashIconStyle}>
                                    <Ionicons name="trash-outline" size={16} color="white" />
                                </Animated.View>
                            </Animated.View>
                        </Animated.View>
                    );
                })}
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

// Height of the "Skip for now" row. It is subtracted back out of the CTA
// wrapper's margin, so the row must carry a known height rather than being
// sized by its text.
const SKIP_ROW_HEIGHT = 36;

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
        slideOffset.value = withSpring(next, SPRING.slide);
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
            // Floor the bottom inset: on home-button devices it is 0, which
            // would leave the skip link hanging past the screen edge.
            style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}
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

                {/* Primary CTA. The skip row below it is cancelled out of the
                    column with a matching negative margin, so it hangs into the
                    bottom padding instead of lifting the CTA — the primary
                    button holds the same line on all three steps. */}
                <View style={isLastStep ? { marginBottom: -SKIP_ROW_HEIGHT } : undefined}>
                    <GradientPillButton
                        label={isLastStep ? 'Allow Photo Access' : 'Continue'}
                        onPress={isLastStep ? handleFinish : goNext}
                    />

                    {/* Skip (last step only, visually quiet) */}
                    {isLastStep && (
                        <Pressable
                            onPress={handleSkip}
                            accessibilityRole="button"
                            hitSlop={{ left: 60, right: 60 }}
                            className="items-center justify-center active:opacity-60"
                            style={{ height: SKIP_ROW_HEIGHT }}
                        >
                            <Text className="text-white/40 text-sm">Skip for now</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </View>
    );
}
