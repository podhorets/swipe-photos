import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconWell } from '@/components/ui/IconWell';
import type { TileColor } from '@/constants/colors';
import { useTheme } from '@/lib/theme/ThemeProvider';

/** "PRIVACY & SECURITY" — section label above a grouped card. */
export function SectionLabel({ children, className = '' }: { children: string; className?: string }) {
  return (
    <Text className={`text-fg-2 text-[12px] font-bold uppercase mb-2 ml-1 ${className}`} style={{ letterSpacing: 1.4 }}>
      {children}
    </Text>
  );
}

/** 1pt row separator inside a grouped card, inset past the icon well. */
export function RowDivider() {
  return <View className="h-px bg-divider ml-[58px]" />;
}

interface SettingsRowProps {
  icon: IconName;
  color: TileColor;
  label: string;
  subtitle?: string;
  /** Right side: a value, a control, or (when onPress is set) a chevron. */
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  children?: React.ReactNode;
}

/** Grouped-card row: icon well, label (+ subtitle), value / control / chevron. */
export function SettingsRow({ icon, color, label, subtitle, value, right, onPress, children }: SettingsRowProps) {
  const t = useTheme();
  const content = (
    <View className="px-3.5 py-3 min-h-[54px]">
      <View className="flex-row items-center gap-3">
        <IconWell icon={icon} color={color} />
        <View className="flex-1">
          <Text className="text-fg text-[16px] font-medium">{label}</Text>
          {subtitle ? <Text className="text-fg-2 text-[12.5px] mt-0.5">{subtitle}</Text> : null}
        </View>
        {value ? <Text className="text-fg-2 text-[15px]">{value}</Text> : null}
        {right}
        {onPress && !right ? <Icon name="chevron" size={14} color={t.text.tertiary} strokeWidth={2.4} /> : null}
      </View>
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="active:opacity-70">
      {content}
    </Pressable>
  );
}
