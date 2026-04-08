import { View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSession } from '@/hooks/useSession';
import { useGalleryStore } from '@/stores/galleryStore';
import { SwipeCard } from './SwipeCard';
import { SWIPE } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

interface SwipeStackProps {
  onDoubleTap: (assetId: string) => void;
  onSessionComplete: () => void;
}

export function SwipeStack({ onDoubleTap, onSessionComplete }: SwipeStackProps) {
  const { visibleAssetIds, swipeLeft, swipeRight, swipeUp, isComplete, session } =
    useSession();
  const index = useGalleryStore((s) => s.index);

  // Build a quick id→uri lookup from the gallery index
  const uriById = new Map(index.map((a) => [a.id, a.uri]));

  // Prefetch the next cards beyond the visible stack
  const prefetchIds = session?.assetIds.slice(
    (session.assetIds.length - visibleAssetIds.length),
  ) ?? [];

  prefetchIds.forEach((id) => {
    const uri = uriById.get(id);
    if (uri) Image.prefetch(uri);
  });

  if (isComplete) {
    onSessionComplete();
    return null;
  }

  if (visibleAssetIds.length === 0) return null;

  // Render back-to-front so the top card (index 0) is on top
  const renderIds = [...visibleAssetIds].reverse();

  return (
    <View
      style={{
        height: CARD_HEIGHT + SWIPE.stackOffsetY[SWIPE.stackSize - 1],
        position: 'relative',
      }}
    >
      {renderIds.map((assetId, reversedIndex) => {
        const stackIndex = visibleAssetIds.length - 1 - reversedIndex;
        const uri = uriById.get(assetId) ?? '';

        return (
          <SwipeCard
            key={assetId}
            uri={uri}
            stackIndex={stackIndex}
            onSwipeLeft={() => swipeLeft(assetId)}
            onSwipeRight={() => swipeRight(assetId)}
            onSwipeUp={() => swipeUp(assetId)}
            onDoubleTap={() => onDoubleTap(assetId)}
          />
        );
      })}
    </View>
  );
}
