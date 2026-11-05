import { View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { TileColor } from '@/constants/colors';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface IconWellProps {
  icon: IconName;
  color?: TileColor;
  /** 32 (rows, tiles) · 38 (cards) · 56 (empty states) */
  size?: number;
}

/** Tinted rounded square with an outline icon (tile colour per item). */
export function IconWell({ icon, color = 'blue', size = 32 }: IconWellProps) {
  const t = useTheme();
  const tile = t.tile[color];
  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), backgroundColor: tile.bg }}
    >
      <Icon name={icon} size={Math.round(size * 0.53)} color={tile.fg} />
    </View>
  );
}
