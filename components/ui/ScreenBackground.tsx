import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme/ThemeProvider';

/**
 * Screen background: light is a soft vertical sky gradient, dark is flat
 * navy. Place as the first child of a `flex-1` root; content stacks above.
 */
export function ScreenBackground() {
  const t = useTheme();
  return (
    <LinearGradient
      colors={t.background.colors}
      locations={t.background.locations}
      // LinearGradient isn't a NativeWind component, so no className
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      pointerEvents="none"
    />
  );
}
