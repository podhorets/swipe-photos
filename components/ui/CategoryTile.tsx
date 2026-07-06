import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';

interface CategoryTileProps {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  coverUri?: string;
  width: number;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

const SCRIM = ['rgba(5,5,8,0.15)', 'rgba(5,5,8,0.82)'] as const;

/** Photo-forward category tile for the Home 2×2 grid. */
export function CategoryTile({
  label,
  subtitle,
  icon,
  count,
  coverUri,
  width,
  disabled = false,
  loading = false,
  onPress,
}: CategoryTileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`active:opacity-80 ${disabled ? 'opacity-40' : ''}`}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} items`}
    >
      <View
        className="rounded-3xl overflow-hidden border border-white/[0.14] bg-white/[0.06]"
        style={{ width, height: 122 }}
      >
        {coverUri && (
          <Image
            source={{ uri: coverUri }}
            contentFit="cover"
            recyclingKey={coverUri}
            transition={150}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        )}
        <LinearGradient
          colors={SCRIM}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* Count pill */}
        <View className="absolute top-3 right-3 rounded-full overflow-hidden">
          <BlurView intensity={20} tint="dark" className="px-2.5 py-1 bg-scrim">
            <Text className="text-white text-xs font-bold">
              {loading ? '…' : count.toLocaleString()}
            </Text>
          </BlurView>
        </View>
        {/* Label block */}
        <View className="absolute left-3.5 right-3.5 bottom-3">
          <Ionicons name={icon} size={20} color="#FFFFFF" style={{ marginBottom: 4 }} />
          <Text className="text-white text-base font-bold" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-white/60 text-xs mt-px" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
