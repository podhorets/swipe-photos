import { DemoFill } from '@/components/ui/DemoFill';
import { Icon } from '@/components/ui/Icon';
import { DEMO_GRADIENTS, ON_PHOTO } from '@/constants/colors';
import { SWIPE_DEMO_CARDS } from '@/constants/demoPhotos';
import { gatedHaptic } from '@/lib/haptics';
import { useTheme } from '@/lib/theme/ThemeProvider';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const FLY = 420; // off the hero viewport
const DRAG = 48; // "hesitation" drag before commit
const CARD_W = 104;
const CARD_H = 130;

interface PaywallHeroProps {
    /** Amber lock chip above the demo, e.g. "2 of 2 free reviews used today". */
    lockLabel?: string;
}

/**
 * Paywall living hero (design 2b): optional lock chip + auto-swiping card demo.
 * Same motion vocabulary as onboarding's SwipeDemo (pause → drag → fly,
 * alternating delete/keep), pure UI-thread transforms, light haptic per commit.
 */
export function PaywallHero({ lockLabel }: PaywallHeroProps) {
    const t = useTheme();
    const x = useSharedValue(0);

    useEffect(() => {
        x.value = 0;
        x.value = withRepeat(
            withSequence(
                withDelay(700, withTiming(-DRAG, { duration: 450, easing: Easing.out(Easing.quad) })),
                withTiming(-FLY, { duration: 320, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 1 }),
                withDelay(900, withTiming(DRAG, { duration: 450, easing: Easing.out(Easing.quad) })),
                withTiming(FLY, { duration: 320, easing: Easing.in(Easing.quad) }),
                withTiming(0, { duration: 1 }),
                withDelay(900, withTiming(0, { duration: 1 })),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(x);
    }, [x]);

    // Haptic beat when the demo card commits a decision
    useAnimatedReaction(
        () => x.value,
        (cur, prev) => {
            if (prev === null) return;
            const th = DRAG - 4;
            if ((prev > -th && cur <= -th) || (prev < th && cur >= th)) {
                scheduleOnRN(gatedHaptic, Haptics.ImpactFeedbackStyle.Light);
            }
        },
        [],
    );

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: x.value },
            { rotate: `${interpolate(x.value, [-FLY, 0, FLY], [-0.28, 0, 0.28], Extrapolation.CLAMP)}rad` },
        ],
        opacity: interpolate(Math.abs(x.value), [0, FLY * 0.6, FLY * 0.85], [1, 1, 0], Extrapolation.CLAMP),
    }));
    const delStyle = useAnimatedStyle(() => ({
        opacity: interpolate(x.value, [-DRAG, -DRAG * 0.35], [1, 0], Extrapolation.CLAMP),
    }));
    const keepStyle = useAnimatedStyle(() => ({
        opacity: interpolate(x.value, [DRAG * 0.35, DRAG], [0, 1], Extrapolation.CLAMP),
    }));

    return (
        <View className="items-center gap-2.5" style={{ height: lockLabel ? 190 : 150, justifyContent: 'center' }}>
            {lockLabel && (
                <View className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-tile-amber">
                    <Icon name="lock" size={12} color={t.tile.amber.fg} strokeWidth={2.4} />
                    <Text className="text-tile-amber-fg text-[12px] font-bold">{lockLabel}</Text>
                </View>
            )}
            <View className="items-center justify-center overflow-hidden" style={{ width: 250, height: CARD_H + 30 }}>
                {/* Back card */}
                <View
                    className="overflow-hidden border-[3px] border-card"
                    style={{
                        position: 'absolute',
                        width: CARD_W,
                        height: CARD_H,
                        borderRadius: 14,
                        transform: [{ scale: 0.94 }, { translateY: 8 }],
                        opacity: 0.85,
                    }}
                >
                    <DemoFill photo={SWIPE_DEMO_CARDS[1].photo} gradient={DEMO_GRADIENTS.teal} />
                </View>
                {/* Auto-swiping top card */}
                <Animated.View
                    className="absolute overflow-hidden border-[3px] border-card"
                    style={[
                        { width: CARD_W, height: CARD_H, borderRadius: 14, boxShadow: t.shadow.card },
                        cardStyle,
                    ]}
                >
                    <DemoFill photo={SWIPE_DEMO_CARDS[0].photo} gradient={DEMO_GRADIENTS.sky} />
                    <Animated.View
                        className="absolute inset-0 items-center justify-center gap-0.5"
                        style={[{ backgroundColor: ON_PHOTO.deleteOverlay }, delStyle]}
                        pointerEvents="none"
                    >
                        <Icon name="trash" size={24} color={ON_PHOTO.text} />
                        <Text className="text-on-photo font-bold text-[11px] tracking-widest">DELETE</Text>
                    </Animated.View>
                    <Animated.View
                        className="absolute inset-0 items-center justify-center gap-0.5"
                        style={[{ backgroundColor: ON_PHOTO.keepOverlay }, keepStyle]}
                        pointerEvents="none"
                    >
                        <Icon name="checkCircle" size={24} color={ON_PHOTO.text} />
                        <Text className="text-on-photo font-bold text-[11px] tracking-widest">KEEP</Text>
                    </Animated.View>
                </Animated.View>
            </View>
        </View>
    );
}
