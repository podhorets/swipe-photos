import { Pressable, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { IconWell } from '@/components/ui/IconWell';
import type { IconName } from '@/components/ui/Icon';
import type { TileColor } from '@/constants/colors';

interface ShortcutTileProps {
  label: string;
  subtitle: string;
  icon: IconName;
  color: TileColor;
  width: number;
  onPress: () => void;
}

/** Small Home shortcut to another tab (Feed, Similar, Library views). */
export function ShortcutTile({ label, subtitle, icon, color, width, onPress }: ShortcutTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${subtitle}`}
      className="active:opacity-70"
      style={{ width }}
    >
      <Card radius={18} className="flex-row items-center gap-[9px] px-2.5 min-h-[53px] py-2">
        <IconWell icon={icon} color={color} />
        <View className="flex-1">
          <Text className="text-fg font-bold text-[14.5px]" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-fg-2 text-[11px]" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
