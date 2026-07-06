import React from 'react';
import { Text, Pressable, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSpringPress } from '@/hooks/useSpringPress';
import { GRADIENTS } from '@/constants/theme';

interface GradientPillButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'accent' | 'delete';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  compact?: boolean; // inline pill (trash bar) instead of full-width CTA
  disabled?: boolean;
  loading?: boolean;
}

const VARIANTS = {
  accent: {
    colors: GRADIENTS.accent,
    shadow: { shadowColor: '#0A84FF', shadowOpacity: 0.35, shadowRadius: 32, shadowOffset: { width: 0, height: 12 } },
  },
  delete: {
    colors: GRADIENTS.delete,
    shadow: { shadowColor: '#FF453A', shadowOpacity: 0.35, shadowRadius: 26, shadowOffset: { width: 0, height: 10 } },
  },
};

/** Gradient CTA pill — full-width by default, `compact` for inline bars. */
export function GradientPillButton({
  label,
  onPress,
  variant = 'accent',
  icon,
  compact = false,
  disabled = false,
  loading = false,
}: GradientPillButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress(0.96);
  const cfg = VARIANTS[variant];

  return (
    <Animated.View style={[animatedStyle, disabled ? undefined : cfg.shadow, { opacity: disabled ? 0.4 : 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="rounded-full overflow-hidden"
      >
        <LinearGradient
          colors={cfg.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: compact ? 13 : 17,
            paddingHorizontal: compact ? 22 : 0,
          }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="flex-row items-center gap-2">
              {icon && <Ionicons name={icon} size={compact ? 14 : 16} color="white" />}
              <Text
                className={compact ? 'text-white font-bold text-[15px]' : 'text-white font-bold text-[17px]'}
                style={{ letterSpacing: -0.2 }}
              >
                {label}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
