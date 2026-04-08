import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder — replaced on Day 5
export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-black px-6">
      <SafeAreaView>
        <Text className="text-white text-4xl font-bold mt-10">Settings</Text>
      </SafeAreaView>
    </View>
  );
}
