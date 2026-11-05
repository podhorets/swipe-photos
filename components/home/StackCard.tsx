import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PhotoChip } from '@/components/ui/PhotoChip';
import { StartPill } from '@/components/ui/PrimaryButton';
import { ON_PHOTO } from '@/constants/colors';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface StackCardProps {
  title: string;
  subtitle: string;
  icon: IconName;
  coverUri?: string;
  height: number;
  /** Small chip in the top-left corner, e.g. "Today" */
  badge?: string;
  onStart: () => void;
  /** Tapping the card outside Start (e.g. opens the year-by-year screen) */
  onPress?: () => void;
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Full-width photo card for a review stack on Home, with its own Start pill. */
export function StackCard({ title, subtitle, icon, coverUri, height, badge, onStart, onPress }: StackCardProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress ?? onStart}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className="active:opacity-90"
    >
      <View
        className="rounded-[22px] overflow-hidden bg-track"
        style={{ height, boxShadow: t.shadow.card }}
      >
        {coverUri && (
          <Image source={{ uri: coverUri }} contentFit="cover" recyclingKey={coverUri} transition={150} style={FILL} />
        )}
        <LinearGradient colors={ON_PHOTO.scrim} locations={ON_PHOTO.scrimLocations} style={FILL} />
        {badge && (
          <View className="absolute top-2.5 left-3">
            <PhotoChip label={badge} small />
          </View>
        )}
        <View className="absolute left-3.5 right-3 bottom-3 flex-row items-end gap-3">
          <View className="flex-1">
            <Icon name={icon} size={20} color={ON_PHOTO.text} strokeWidth={1.8} />
            <Text className="font-display text-on-photo text-[20px] mt-0.5" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-on-photo-2 text-[12.5px]" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <StartPill onPress={onStart} label="Start" />
        </View>
      </View>
    </Pressable>
  );
}
