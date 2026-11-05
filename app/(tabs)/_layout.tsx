import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { useGalleryIndex } from '@/hooks/useGalleryIndex';

function GalleryIndexBootstrap() {
  useGalleryIndex();
  return null;
}

export default function TabLayout() {
  return (
    <>
      {/* Starts indexing as soon as tabs mount, independent of which tab is active */}
      <GalleryIndexBootstrap />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
        <Tabs.Screen name="similar" options={{ title: 'Similar' }} />
        <Tabs.Screen name="by-month" options={{ title: 'Library' }} />
      </Tabs>
    </>
  );
}
