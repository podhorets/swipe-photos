import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View className="flex-1 items-center justify-center bg-black p-5">
        <Text className="text-white text-xl font-bold">This page isn't available.</Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-blue-400 text-sm">Back to Library</Text>
        </Link>
      </View>
    </>
  );
}
