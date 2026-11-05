import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconWell } from '@/components/ui/IconWell';
import { ON_PHOTO } from '@/constants/colors';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface CategoryTileProps {
  label: string;
  subtitle: string;
  icon: IconName;
  count: number;
  coverUri?: string;
  width: number;
  /** A plain card with a blue icon well instead of a photo (Screenshots). */
  plain?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

const HEIGHT = 118;
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Library › Types tile: a photo with a count chip, or a plain card. */
export function CategoryTile({
  label,
  subtitle,
  icon,
  count,
  coverUri,
  width,
  plain = false,
  disabled = false,
  loading = false,
  onPress,
}: CategoryTileProps) {
  const t = useTheme();
  const countLabel = loading ? '…' : count.toLocaleString();
  const showPhoto = !plain && coverUri != null;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`active:opacity-80 ${disabled ? 'opacity-40' : ''}`}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} items`}
    >
      {showPhoto ? (
        <View className="rounded-[22px] overflow-hidden bg-track" style={{ width, height: HEIGHT, boxShadow: t.shadow.card }}>
          <Image source={{ uri: coverUri }} contentFit="cover" recyclingKey={coverUri} transition={150} style={FILL} />
          <LinearGradient colors={ON_PHOTO.scrim} locations={[0, 1]} style={FILL} />
          <View className="absolute top-2.5 right-2.5 min-w-[22px] h-[22px] px-[7px] rounded-full bg-chip items-center justify-center">
            <Text className="text-chip-fg text-[11px] font-extrabold">{countLabel}</Text>
          </View>
          <View className="absolute left-3 right-3 bottom-2.5">
            <Icon name={icon} size={18} color={ON_PHOTO.text} />
            <Text className="font-display text-on-photo text-[17px]" numberOfLines={1}>
              {label}
            </Text>
            <Text className="text-on-photo-2 text-[11.5px]" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      ) : (
        <Card style={{ width, height: HEIGHT }}>
          <View className="absolute top-2.5 right-2.5 min-w-[22px] h-[22px] px-[7px] rounded-full bg-raised items-center justify-center">
            <Text className="text-fg-2 text-[11px] font-extrabold">{countLabel}</Text>
          </View>
          <View className="absolute left-3 top-3.5">
            <IconWell icon={icon} color="blue" />
          </View>
          <View className="absolute left-3 right-3 bottom-2.5">
            <Text className="font-display text-fg text-[17px]" numberOfLines={1}>
              {label}
            </Text>
            <Text className="text-fg-2 text-[11.5px]" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </Card>
      )}
    </Pressable>
  );
}
