import '../global.css';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, LogBox } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostHogProvider } from 'posthog-react-native';
import { enableMapSet } from 'immer';
import { useFonts, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGalleryStore } from '@/stores/galleryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { scheduleOnThisDayNotification } from '@/lib/notifications';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeProvider, useSceneStyle } from '@/lib/theme/ThemeProvider';
import { posthog } from '@/lib/posthog';
import { initPurchases, refreshCustomerInfo } from '@/lib/purchases';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://5f918fbd3f8c5901db3e4ecde4d73e35@o4511027063291904.ingest.de.sentry.io/4511338069950544',

  // Settings → "Share Analytics" covers crash reports too (applies on next launch)
  enabled: !__DEV__ && useSettingsStore.getState().analyticsOptIn,

  // No IP address, cookies or user data — matches the App Store privacy label
  sendDefaultPii: false,

  enableLogs: true,

  // Replays only around crashes, with every image and text masked: the user's
  // photos must never leave the device
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration({ maskAllText: true, maskAllImages: true, maskAllVectors: true }),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Required for Immer to handle Set and Map in Zustand stores
enableMapSet();

// Expected in dev with EXPO_PUBLIC_REVENUECAT_TEST_KEY; its LogBox toast sits
// over the bottom CTAs on every launch
if (__DEV__) LogBox.ignoreLogs(['Using a Test Store API key']);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function NotificationBootstrap() {
  const index = useGalleryStore((s) => s.index);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Reschedule notification when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (notificationsEnabled && index.length > 0) {
          scheduleOnThisDayNotification(index).catch(() => {});
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [index, notificationsEnabled]);

  // Schedule on mount if enabled
  useEffect(() => {
    if (notificationsEnabled && index.length > 0) {
      scheduleOnThisDayNotification(index).catch(() => {});
    }
  }, [index, notificationsEnabled]);

  // Navigate to On This Day when user taps notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.navigateTo === 'on-this-day') {
        router.push('/on-this-day');
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

function RootStack() {
  const contentStyle = useSceneStyle();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="review/[sessionId]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="review/preview/[assetId]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="on-this-day" />
      <Stack.Screen name="trash" options={{ presentation: 'modal' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}

function RootLayout() {
  const analyticsOptIn = useSettingsStore((s) => s.analyticsOptIn);
  // Display face (titles, big numbers). On a load error the system font is
  // used, so the splash still hides.
  const [fontsLoaded, fontError] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold });
  const fontsReady = fontsLoaded || fontError != null;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  // RevenueCat: configure once, re-check entitlements on foreground (expiry/renewal)
  useEffect(() => {
    initPurchases();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshCustomerInfo();
    });
    return () => sub.remove();
  }, []);

  // Sync analytics opt-in/out with PostHog
  useEffect(() => {
    if (analyticsOptIn) {
      posthog.optIn();
    } else {
      posthog.optOut();
    }
  }, [analyticsOptIn]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView className="flex-1">
      <PostHogProvider
        client={posthog}
        autocapture={false}
      >
        <ThemeProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <NotificationBootstrap />
              <RootStack />
            </QueryClientProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
