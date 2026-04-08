import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder — replaced on Day 4
export default function TrashScreen() {
  return (
    <View className="flex-1 bg-black px-6">
      <SafeAreaView>
        <Text className="text-white text-4xl font-bold mt-10">Trash</Text>
        <Text className="text-white/60 text-lg mt-2">Staged for deletion</Text>
      </SafeAreaView>
    </View>
  );
}
