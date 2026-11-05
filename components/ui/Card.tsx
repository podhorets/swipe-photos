import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Floating cards (bottom bars over content) use the stronger shadow. */
  floating?: boolean;
  /** No shadow — for cards nested in another card or in long lists. */
  flat?: boolean;
}

/** Solid surface: card colour, 1pt hairline border, soft shadow. */
export function Card({ children, className = '', style, radius = 22, floating = false, flat = false }: CardProps) {
  const t = useTheme();
  return (
    <View
      className={`bg-card border border-hairline ${className}`}
      style={[
        { borderRadius: radius },
        flat ? undefined : { boxShadow: floating ? t.shadow.floating : t.shadow.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}
