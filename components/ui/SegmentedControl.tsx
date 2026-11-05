import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Options rendered with a star badge; presses go to onLockedPress instead of onChange. */
  lockedOptions?: readonly T[];
  onLockedPress?: (value: T) => void;
  /** `tint` (Settings): the active segment uses the accent tint. */
  variant?: 'default' | 'tint';
}

/** iOS-style segmented control on a raised track. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  lockedOptions,
  onLockedPress,
  variant = 'default',
}: SegmentedControlProps<T>) {
  const t = useTheme();
  const tint = variant === 'tint';
  return (
    <View className="flex-row gap-1 p-[3px] rounded-[13px] bg-raised">
      {options.map((opt) => {
        const selected = opt === value;
        const locked = lockedOptions?.includes(opt) ?? false;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => (locked ? onLockedPress?.(opt) : onChange(opt))}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: locked }}
            className={`flex-1 min-h-[35px] rounded-[10px] flex-row items-center justify-center gap-1 ${
              selected ? (tint ? 'bg-tint' : 'bg-segment') : ''
            }`}
            style={selected && !tint ? { boxShadow: t.shadow.segment } : undefined}
          >
            <Text
              className={`text-[14.5px] font-bold ${
                selected ? (tint ? 'text-on-tint' : 'text-segment-fg') : 'text-fg-2'
              }`}
            >
              {opt}
            </Text>
            {locked && <Icon name="star" size={11} color={t.star} fill={t.star} />}
          </Pressable>
        );
      })}
    </View>
  );
}
