import { Component, type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

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

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View className="flex-1 bg-black px-6 pt-16">
          <Text className="text-red-400 text-lg font-bold mb-3">Crash caught</Text>
          <Text className="text-white font-semibold mb-2">{error.message}</Text>
          <ScrollView className="flex-1">
            <Text className="text-white/50 text-xs font-mono">{error.stack}</Text>
          </ScrollView>
          <Pressable
            className="mt-4 mb-8 bg-white/10 rounded-2xl py-4 items-center"
            onPress={() => this.setState({ error: null })}
          >
            <Text className="text-white font-semibold">Dismiss</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
