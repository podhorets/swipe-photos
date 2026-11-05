import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface CircleButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** 38 by default (34 in the Home header) — hit area is always ≥ 44 */
  size?: number;
  /** Over a photo (preview): photo-chip background instead of a card. */
  onPhoto?: boolean;
  className?: string;
}

/** Round icon button: back, close, settings, undo. */
export function CircleButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 38,
  onPhoto = false,
  className = '',
}: CircleButtonProps) {
  const t = useTheme();
  const slop = Math.max(0, Math.ceil((44 - size) / 2));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={slop}
      className={`items-center justify-center rounded-full active:opacity-75 ${
        onPhoto ? 'bg-chip' : 'bg-card border border-hairline'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon name={icon} size={icon === 'gear' ? 18 : 16} color={onPhoto ? t.photoChip.text : t.text.primary} strokeWidth={icon === 'gear' ? 2 : 2.4} />
    </Pressable>
  );
}

/** Back circle for pushed screens. */
export function BackCircle({ className = '' }: { className?: string }) {
  return <CircleButton icon="back" onPress={() => router.back()} accessibilityLabel="Go back" className={className} />;
}
