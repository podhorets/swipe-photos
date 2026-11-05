import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useSpringPress } from '@/hooks/useSpringPress';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** `delete` is the red Trash action; everything else is accent. */
  variant?: 'accent' | 'delete';
  icon?: IconName;
  /** Inline pill (Trash bar) instead of the 52pt full-width CTA. */
  compact?: boolean;
  /** Floating over content: adds the floating shadow. */
  floating?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

/** Solid primary button: accent fill, white label, optional leading icon. */
export function PrimaryButton({
  label,
  onPress,
  variant = 'accent',
  icon,
  compact = false,
  floating = false,
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  const t = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useSpringPress(0.96);

  return (
    <Animated.View style={[animatedStyle, { opacity: disabled ? 0.45 : 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={`rounded-full items-center justify-center ${variant === 'delete' ? 'bg-del-fill' : 'bg-button'} ${
          compact ? 'min-h-[43px] px-[18px]' : 'min-h-[52px] px-6'
        }`}
        style={floating && !disabled ? { boxShadow: t.shadow.floating } : undefined}
      >
        {loading ? (
          <ActivityIndicator color={t.text.onButton} />
        ) : (
          <View className="flex-row items-center gap-2">
            {icon && <Icon name={icon} size={compact ? 16 : 18} color={t.text.onButton} />}
            <Text className={`text-on-button font-bold ${compact ? 'text-[15.5px]' : 'text-[17px]'}`}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** "Start" pill on photo cards (42pt). */
export function StartPill({ label = 'Start', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[42px] px-[18px] rounded-full bg-button items-center justify-center active:opacity-85"
    >
      <Text className="text-on-button text-[15px] font-bold">{label}</Text>
    </Pressable>
  );
}

/** "Review 2 ›" — tinted pill with a chevron. */
export function TintPill({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[32px] px-3 rounded-full bg-tint flex-row items-center gap-1 active:opacity-80"
    >
      <Text className="text-on-tint text-[14px] font-bold">{label}</Text>
      <Icon name="chevron" size={12} color={t.accent.onTint} strokeWidth={2.6} />
    </Pressable>
  );
}
