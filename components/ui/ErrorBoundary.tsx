import { Component, type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
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
        <View className="flex-1 items-center justify-center">
          <ScreenBackground />
          <EmptyState
            icon="warning"
            color="amber"
            title="Something went wrong"
            body="Your photos are safe — nothing was deleted. Please try again."
            action={{ label: 'Try Again', onPress: () => this.setState({ error: null }) }}
          >
            {__DEV__ && (
              <Text className="text-del-icon text-xs mt-4 text-center" numberOfLines={4}>
                {error.message}
              </Text>
            )}
          </EmptyState>
        </View>
      );
    }
    return this.props.children;
  }
}
