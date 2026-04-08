import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder — replaced fully on Day 2
export default function HomeScreen() {
  return (
    <View className="flex-1 bg-black px-6">
      <SafeAreaView>
        <Text className="text-white text-4xl font-bold mt-10">Swipe Photos</Text>
        <Text className="text-white/60 text-lg mt-2">Library loading…</Text>
      </SafeAreaView>
    </View>
  );
}
