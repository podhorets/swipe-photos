import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';

const SCRIM = ['rgba(5,5,8,0.05)', 'rgba(5,5,8,0.85)'] as const;

interface StackCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  coverUri?: string;
  height: number;
  /** Small pill in the top-left corner, e.g. "Today" */
  badge?: string;
  onStart: () => void;
  /** Tapping the card outside Start (e.g. opens the year-by-year screen) */
  onPress?: () => void;
}

/** Full-width photo card for a review stack on Home, with its own Start button. */
export function StackCard({ title, subtitle, icon, coverUri, height, badge, onStart, onPress }: StackCardProps) {
  return (
    <Pressable
      onPress={onPress ?? onStart}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className="mb-3 active:opacity-90"
    >
      <View className="rounded-3xl overflow-hidden border border-white/[0.14] bg-white/[0.06]" style={{ height }}>
        {coverUri && (
          <Image
            source={{ uri: coverUri }}
            contentFit="cover"
            recyclingKey={coverUri}
            transition={150}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        <LinearGradient colors={SCRIM} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {badge && (
          <View className="absolute top-3 left-3 rounded-full overflow-hidden">
            <BlurView intensity={20} tint="dark" className="px-2.5 py-1 bg-scrim">
              <Text className="text-white text-xs font-bold">{badge}</Text>
            </BlurView>
          </View>
        )}
        <View className="absolute left-4 right-3.5 bottom-3.5 flex-row items-end gap-3">
          <View className="flex-1">
            <Ionicons name={icon} size={20} color="#FFFFFF" style={{ marginBottom: 4 }} />
            <Text className="text-white text-[20px] font-extrabold" style={{ letterSpacing: -0.3 }} numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-white/75 text-[13px] mt-px" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel={`Start ${title}`}
            hitSlop={6}
            className="bg-accent rounded-full px-5 min-h-[44px] items-center justify-center active:opacity-80"
          >
            <Text className="text-white text-[15px] font-bold">Start</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
