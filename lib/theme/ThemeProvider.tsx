import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Appearance, View, useColorScheme } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { THEMES, THEME_VARS, type Theme, type ThemeMode } from '@/constants/colors';
import { useSettingsStore } from '@/stores/settingsStore';
import { useForcedStatusBarStyle } from '@/lib/theme/statusBar';

const ThemeContext = createContext<Theme>(THEMES.dark);

/**
 * Root theme: applies Settings › Appearance to the whole app (including
 * native UI — Alerts, Switch, the iOS delete dialog — via
 * Appearance.setColorScheme), sets the CSS variables every token class reads,
 * and keeps the status bar readable.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const appearance = useSettingsStore((s) => s.appearance);

  useEffect(() => {
    // null = follow the system (RN < 0.82 maps it to 'unspecified')
    Appearance.setColorScheme(appearance === 'system' ? null : appearance);
  }, [appearance]);

  const scheme = useColorScheme();
  // Before the override effect runs, the stored choice wins over the system
  const mode: ThemeMode = appearance !== 'system' ? appearance : scheme === 'light' ? 'light' : 'dark';
  const theme = THEMES[mode];

  const forced = useForcedStatusBarStyle();
  useEffect(() => {
    setStatusBarStyle(forced ?? (mode === 'dark' ? 'light' : 'dark'), true);
  }, [forced, mode]);

  return (
    <ThemeContext.Provider value={theme}>
      <View className="flex-1 bg-screen" style={THEME_VARS[mode]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/**
 * Forces a theme for a subtree, whatever the app theme is: the Feed and the
 * photo preview are always dark. Token classes and useTheme() inside follow it.
 */
export function ThemeScope({
  mode,
  className = 'flex-1',
  pointerEvents,
  children,
}: {
  mode: ThemeMode;
  className?: string;
  pointerEvents?: 'box-none' | 'auto';
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={THEMES[mode]}>
      <View className={className} style={THEME_VARS[mode]} pointerEvents={pointerEvents}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/** Theme colours for props that can't take a className (icon colours, gradients, shadows). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Navigator scene background, so transitions never flash another colour. */
export function useSceneStyle() {
  const theme = useTheme();
  return useMemo(() => ({ backgroundColor: theme.screen }), [theme]);
}
