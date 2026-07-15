import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface SegmentedControlProps<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Options rendered with a star badge; presses go to onLockedPress instead of onChange. */
  lockedOptions?: readonly T[];
  onLockedPress?: (value: T) => void;
}

/** iOS-style segmented control on a recessed dark track. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  lockedOptions,
  onLockedPress,
}: SegmentedControlProps<T>) {
  return (
    <View className="flex-row gap-1.5 p-1 rounded-[14px] bg-black/35">
      {options.map((opt) => {
        const selected = opt === value;
        const locked = lockedOptions?.includes(opt) ?? false;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => (locked ? onLockedPress?.(opt) : onChange(opt))}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: locked }}
            className={`flex-1 py-[9px] rounded-[11px] items-center ${
              selected ? 'bg-white/[0.16] border-[0.5px] border-white/20' : ''
            }`}
          >
            <Text
              className={
                selected ? 'text-white text-[15px] font-bold' : 'text-white/50 text-[15px] font-semibold'
              }
            >
              {opt}
            </Text>
            {locked && (
              <View className="absolute top-1 right-1.5">
                <Ionicons name="star" size={9} color="#FF9F0A" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
