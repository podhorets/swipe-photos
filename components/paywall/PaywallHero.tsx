import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useAnimatedReaction,
    useSharedValue,
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { gatedHaptic } from '@/lib/haptics';
import { GRADIENTS } from '@/constants/theme';

const FLY = 420; // off the hero viewport
const DRAG = 48; // "hesitation" drag before commit
const CARD_W = 112;
const CARD_H = 136;

interface PaywallHeroProps {
    /** Amber lock chip above the demo, e.g. "2 of 2 free sessions used today". */
    lockLabel?: string;
}

/**
 * Paywall living hero (design 2b): optional lock chip + auto-swiping card demo.
 * Same motion vocabulary as onboarding's SwipeDemo (pause → drag → fly,
 * alternating delete/keep), pure UI-thread transforms, light haptic per commit.
 */
export function PaywallHero({ lockLabel }: PaywallHeroProps) {
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
        <View className="items-center gap-2.5" style={{ height: 190, justifyContent: 'center' }}>
            {lockLabel && (
                <View
                    className="flex-row items-center gap-1.5 px-3.5 py-1.5 rounded-full border"
                    style={{ backgroundColor: 'rgba(255,159,10,0.14)', borderColor: 'rgba(255,159,10,0.4)' }}
                >
                    <Ionicons name="lock-closed" size={12} color="#FF9F0A" />
                    <Text className="text-streak text-[12px] font-bold">{lockLabel}</Text>
                </View>
            )}
            <View className="items-center justify-center overflow-hidden" style={{ width: 250, height: CARD_H + 10 }}>
                {/* Back card */}
                <LinearGradient
                    colors={GRADIENTS.analytics}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        position: 'absolute',
                        width: CARD_W,
                        height: CARD_H,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.25)',
                        transform: [{ scale: 0.94 }, { translateY: 8 }],
                        opacity: 0.85,
                    }}
                />
                {/* Auto-swiping top card */}
                <Animated.View
                    className="absolute overflow-hidden"
                    style={[
                        {
                            width: CARD_W,
                            height: CARD_H,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.35)',
                            shadowColor: '#000',
                            shadowOpacity: 0.5,
                            shadowRadius: 18,
                            shadowOffset: { width: 0, height: 12 },
                        },
                        cardStyle,
                    ]}
                >
                    <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
                    <Animated.View
                        className="absolute inset-0 items-center justify-center gap-0.5"
                        style={[{ backgroundColor: 'rgba(255,69,58,0.82)' }, delStyle]}
                        pointerEvents="none"
                    >
                        <Ionicons name="trash-outline" size={24} color="white" />
                        <Text className="text-white font-bold text-[11px] tracking-widest">DELETE</Text>
                    </Animated.View>
                    <Animated.View
                        className="absolute inset-0 items-center justify-center gap-0.5"
                        style={[{ backgroundColor: 'rgba(48,209,88,0.82)' }, keepStyle]}
                        pointerEvents="none"
                    >
                        <Ionicons name="checkmark-circle-outline" size={24} color="white" />
                        <Text className="text-white font-bold text-[11px] tracking-widest">KEEP</Text>
                    </Animated.View>
                </Animated.View>
            </View>
        </View>
    );
}
