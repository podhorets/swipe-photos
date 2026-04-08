import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// Placeholder — replaced on Day 3
export default function PreviewScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();

  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <Text className="text-white/60 text-sm">Preview: {assetId}</Text>
    </View>
  );
}
