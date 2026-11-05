import React from 'react';
import { Text, View } from 'react-native';
import { IconWell } from '@/components/ui/IconWell';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { IconName } from '@/components/ui/Icon';
import type { TileColor } from '@/constants/colors';

interface EmptyStateProps {
  icon: IconName;
  color?: TileColor;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; icon?: IconName; loading?: boolean };
  /** Extra content under the button (secondary links). */
  children?: React.ReactNode;
}

/** Centred empty / permission / offline state: icon well, title, body, action. */
export function EmptyState({ icon, color = 'blue', title, body, action, children }: EmptyStateProps) {
  return (
    <View className="items-center px-8">
      <IconWell icon={icon} color={color} size={56} />
      <Text className="font-display text-fg text-[22px] text-center mt-4">{title}</Text>
      {body ? <Text className="text-fg-2 text-[15px] text-center leading-[21px] mt-2">{body}</Text> : null}
      {action && (
        <View className="self-stretch mt-6">
          <PrimaryButton label={action.label} onPress={action.onPress} icon={action.icon} loading={action.loading} />
        </View>
      )}
      {children}
    </View>
  );
}
