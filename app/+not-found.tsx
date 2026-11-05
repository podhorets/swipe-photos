import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenBackground } from '@/components/ui/ScreenBackground';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View className="flex-1 items-center justify-center">
        <ScreenBackground />
        <EmptyState
          icon="images"
          title="This page isn't available."
          action={{ label: 'Back to Library', onPress: () => router.replace('/') }}
        />
      </View>
    </>
  );
}
