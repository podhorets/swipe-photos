import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemeScope, useTheme } from '@/lib/theme/ThemeProvider';

// Bar labels/icons — four tabs, so every label fits and always shows
const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  feed: { label: 'Feed', icon: 'feed' },
  similar: { label: 'Similar', icon: 'similar' },
  'by-month': { label: 'Library', icon: 'library' },
};

function Bar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 px-[18px]"
      style={{ bottom: Math.max(insets.bottom - 4, 26) }}
    >
      <View
        className="flex-row gap-1 rounded-full p-[5px] bg-tab border border-tab-border w-full"
        style={{ boxShadow: t.shadow.floating }}
      >
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const isFocused = state.index === index;
          const color = isFocused ? t.accent.onTint : t.text.tertiary;

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
              <View className={`items-center justify-center rounded-[23px] min-h-[44px] gap-px ${isFocused ? 'bg-tint' : ''}`}>
                <Icon name={meta.icon} size={20} color={color} strokeWidth={1.8} />
                <Text
                  maxFontSizeMultiplier={1.2}
                  className={`text-[10.5px] font-bold ${isFocused ? 'text-on-tint' : 'text-fg-3'}`}
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

/** Floating pill tab bar. Dark while Feed is focused (Feed is always dark). */
export function FloatingTabBar(props: BottomTabBarProps) {
  const { mode } = useTheme();
  const onFeed = props.state.routes[props.state.index]?.name === 'feed';
  return (
    <ThemeScope mode={onFeed ? 'dark' : mode} className="absolute inset-0" pointerEvents="box-none">
      <Bar {...props} />
    </ThemeScope>
  );
}
