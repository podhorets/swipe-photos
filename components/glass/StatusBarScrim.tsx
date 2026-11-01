import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurPanel } from './BlurPanel';
import { COLORS, GLASS } from '@/constants/theme';

// Soft lower edge so the blur doesn't end in a hard line over scrolling content
const FADE_HEIGHT = 16;
const FADE = [`${COLORS.bgDark}B3`, `${COLORS.bgDark}00`] as const;

/**
 * Frosted strip behind the status bar for screens whose content scrolls under
 * it — keeps the clock and Dynamic Island legible over rows and photos.
 * Render it last inside the screen root so it sits above the scroll view.
 */
export function StatusBarScrim() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + FADE_HEIGHT }}
    >
      <View style={{ height: insets.top, overflow: 'hidden' }}>
        <BlurPanel intensity={GLASS.intensity.medium} />
      </View>
      <LinearGradient colors={FADE} style={{ height: FADE_HEIGHT }} />
    </View>
  );
}
