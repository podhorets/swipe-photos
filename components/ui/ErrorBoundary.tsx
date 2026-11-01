import { Component, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    if (__DEV__) console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      // User-facing fallback — never show stack traces outside development
      return (
        <View className="flex-1 bg-bg-dark items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.35)" />
          <Text className="text-white text-xl font-bold mt-5 text-center">Something went wrong</Text>
          <Text className="text-white/60 text-base mt-2 text-center leading-6">
            Your photos are safe — nothing was deleted. Please try again.
          </Text>
          {__DEV__ && (
            <Text className="text-red-300/80 text-xs mt-4 text-center" numberOfLines={4}>
              {error.message}
            </Text>
          )}
          <Pressable
            className="mt-8 bg-white/15 rounded-full px-8 py-4 min-h-[44px] items-center justify-center"
            accessibilityRole="button"
            onPress={() => this.setState({ error: null })}
          >
            <Text className="text-white font-semibold text-base">Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
