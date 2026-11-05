import { Pressable } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Round glass back button for pushed screens (same look as the Trash header). */
export function BackButton({ className = '' }: { className?: string }) {
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={4}
      className={`w-10 h-10 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.14] active:opacity-70 ${className}`}
    >
      <Ionicons name="chevron-back" size={20} color="white" />
    </Pressable>
  );
}
