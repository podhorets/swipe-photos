import React from 'react';
import { Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface PhotoChipProps {
  label: string;
  icon?: IconName;
  /** Defaults to the chip text colour (the trash count uses the delete icon colour) */
  iconColor?: string;
  /** "Best" / "Keep" chips lead with a filled star */
  star?: boolean;
  small?: boolean;
}

/** Chip that sits on a photo: date, size, "Best", counts. */
export function PhotoChip({ label, icon, iconColor, star = false, small = false }: PhotoChipProps) {
  const t = useTheme();
  return (
    <View className={`flex-row items-center gap-1 bg-chip rounded-full ${small ? 'min-h-[22px] px-2' : 'min-h-[24px] px-[9px]'}`}>
      {star && <Icon name="star" size={small ? 12 : 13} color={t.star} fill={t.star} />}
      {icon && <Icon name={icon} size={12} color={iconColor ?? t.photoChip.text} strokeWidth={2.2} />}
      <Text
        maxFontSizeMultiplier={1.3}
        className={`text-chip-fg font-bold ${small ? 'text-[11.5px]' : 'text-[12px]'}`}
      >
        {label}
      </Text>
    </View>
  );
}
