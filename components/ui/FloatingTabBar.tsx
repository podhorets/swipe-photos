import React from 'react';
import { Pressable, View, Text } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurPanel } from '@/components/glass/BlurPanel';
import { SPRING } from '@/constants/theme';

// Bar-only labels/icons (screen titles keep their existing names)
const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Library', icon: 'images' },
  'by-month': { label: 'Months', icon: 'calendar-number' },
  'on-this-day': { label: 'Memories', icon: 'sparkles' },
  settings: { label: 'Settings', icon: 'settings-sharp' },
};

const pillSpring = LinearTransition.springify()
  .damping(SPRING.press.damping)
  .stiffness(SPRING.press.stiffness)
  .mass(SPRING.press.mass);

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
      className="absolute left-0 right-0 items-center"
      style={{ bottom: Math.max(insets.bottom, 26) }}
    >
      <Animated.View
        layout={pillSpring}
        className="flex-row gap-1 rounded-full overflow-hidden p-1.5 bg-chrome"
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
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label}
              onPress={onPress}
            >
              <Animated.View
                layout={pillSpring}
                className={`flex-row items-center rounded-full px-4 py-2.5 gap-[7px] ${
                  isFocused ? 'bg-white/[0.14]' : ''
                }`}
              >
                <Ionicons
                  name={meta.icon}
                  size={20}
                  color={isFocused ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                />
                {isFocused && (
                  <Text className="text-white text-[13px] font-bold">{meta.label}</Text>
                )}
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}
