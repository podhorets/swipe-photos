import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { useGalleryIndex } from '@/hooks/useGalleryIndex';
import { useSceneStyle } from '@/lib/theme/ThemeProvider';

function GalleryIndexBootstrap() {
  useGalleryIndex();
  return null;
}

export default function TabLayout() {
  const sceneStyle = useSceneStyle();
  return (
    <>
      {/* Starts indexing as soon as tabs mount, independent of which tab is active */}
      <GalleryIndexBootstrap />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
        <Tabs.Screen name="similar" options={{ title: 'Similar' }} />
        <Tabs.Screen name="by-month" options={{ title: 'Library' }} />
      </Tabs>
    </>
  );
}
