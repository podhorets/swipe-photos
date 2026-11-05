import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme/ThemeProvider';

// The fade continues this far below the status bar
const FADE_HEIGHT = 18;

/**
 * Fade from the screen background behind the status bar, for screens whose
 * content scrolls under it — keeps the clock legible over rows and photos.
 * Render it last inside the screen root so it sits above the scroll view.
 */
export function StatusBarScrim() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = t.background.colors[0];
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[top, top, `${top}00`]}
      locations={[0, insets.top / (insets.top + FADE_HEIGHT), 1]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + FADE_HEIGHT }}
    />
  );
}
