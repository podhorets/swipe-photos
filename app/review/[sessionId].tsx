import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder — replaced on Day 3
export default function ReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  return (
    <View className="flex-1 bg-black px-6">
      <SafeAreaView>
        <Text className="text-white text-4xl font-bold mt-10">Review</Text>
        <Text className="text-white/60 text-lg mt-2">Session: {sessionId}</Text>
      </SafeAreaView>
    </View>
  );
}
