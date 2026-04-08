import { Redirect } from 'expo-router';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

export default function Index() {
  const hasOnboarded = storage.getBoolean(STORAGE_KEYS.hasCompletedOnboarding);
  return <Redirect href={hasOnboarded ? '/(tabs)' : '/onboarding'} />;
}
