import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassCard } from '@/components/glass/GlassCard';
import { IconSquircle } from '@/components/ui/IconSquircle';

interface ShortcutTileProps {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  width: number;
  onPress: () => void;
}

/** Small glass shortcut on Home that leads to another tab (Feed, Similar, Library views). */
export function ShortcutTile({ label, subtitle, icon, colors, width, onPress }: ShortcutTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${subtitle}`}
      className="active:opacity-70"
      style={{ width }}
    >
      <GlassCard radius={20}>
        <View className="flex-row items-center gap-2.5 p-3">
          <IconSquircle icon={icon} colors={colors} size={34} radius={11} iconSize={17} />
          <View className="flex-1">
            <Text className="text-white font-bold text-[14px]" numberOfLines={1}>
              {label}
            </Text>
            <Text className="text-white/55 text-[11px] mt-px" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}
