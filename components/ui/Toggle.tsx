import { Switch } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** iOS switch in theme colours — on is accent (green only ever means keep). */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel }: ToggleProps) {
  const t = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: t.toggleOff, true: t.toggleOn }}
      ios_backgroundColor={t.toggleOff}
      thumbColor={t.text.onButton}
    />
  );
}
