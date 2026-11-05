import React from 'react';
import { Pressable, View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurPanel } from '@/components/glass/BlurPanel';

// Bar labels/icons — four tabs, so every label fits and always shows
const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Home', icon: 'home' },
  feed: { label: 'Feed', icon: 'albums' },
  similar: { label: 'Similar', icon: 'copy' },
  'by-month': { label: 'Library', icon: 'folder-open' },
};

const BAR_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 40,
  shadowOffset: { width: 0, height: 16 },
  elevation: 12,
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 px-5"
      style={{ bottom: Math.max(insets.bottom, 26) }}
    >
      <View
        className="flex-row justify-between gap-1 rounded-full overflow-hidden p-1.5 bg-chrome w-full"
        style={[
          {
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            borderTopColor: 'rgba(255,255,255,0.28)',
          },
          BAR_SHADOW,
        ]}
      >
        <BlurPanel intensity={60} />
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              className="flex-1"
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
            >
              <View
                className={`items-center rounded-full py-1.5 gap-0.5 ${
                  isFocused ? 'bg-white/[0.14]' : ''
                }`}
              >
                <Ionicons
                  name={meta.icon}
                  size={21}
                  color={isFocused ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
                />
                <Text
                  className={
                    isFocused ? 'text-white text-[11px] font-bold' : 'text-white/50 text-[11px] font-semibold'
                  }
                >
                  {meta.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
