import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { CategoryTile } from '@/components/ui/CategoryTile';
import { MonthRow } from '@/components/ui/MonthRow';
import { AVG_VIDEO_SIZE_BYTES } from '@/constants/config';
import { SCREEN } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';
import { buildPlaceStories, type FeedStory } from '@/lib/feed/stories';
import { getOnThisDay, getScreenshots, getVideos } from '@/lib/gallery/grouper';
import { effectiveBatchSize } from '@/lib/planUtils';
import { startCategoryReview } from '@/lib/session/startCategoryReview';
import { gateSessionStart } from '@/lib/sessionGate';
import { isPhotoAnalyzerAvailable } from 'expo-photo-analyzer';
import { useFeedStore } from '@/stores/feedStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { usePlacesStore } from '@/stores/placesStore';
import { usePlanStore } from '@/stores/planStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AssetMeta } from '@/types';

const TILE_WIDTH = (SCREEN.width - 40 - 12) / 2; // px-5 screen padding, gap-3
// Same smallest story size the Feed uses, so a trip shows in both places
const MIN_PLACE_PHOTOS = 3;

function ratio(assets: AssetMeta[], keepIds: Set<string>): number {
  if (assets.length === 0) return 0;
  return assets.filter((a) => keepIds.has(a.id)).length / assets.length;
}

/** Library › Types: every review stack in one grid, then trips from on-device GPS. */
export function LibraryTypes() {
  const index = useGalleryStore((s) => s.index);
  const isIndexing = useGalleryStore((s) => s.isIndexing);
  const keepIds = useKeepStore((s) => s.keepIds);
  const liked = useFeedStore((s) => s.liked);
  const trashed = useFeedStore((s) => s.trashed);
  const locations = usePlacesStore((s) => s.locations);
  const scanning = usePlacesStore((s) => s.scanning);
  const batchSize = useSettingsStore((s) => s.batchSize);
  const planState = usePlanStore();
  const displayBatchSize = effectiveBatchSize(planState, batchSize);

  // GPS is read in bulk on the device; the Feed does the same, and the store skips photos already checked
  useEffect(() => {
    if (index.length > 0) usePlacesStore.getState().scan(index.map((a) => a.id));
  }, [index]);

  const stacks = useMemo(() => {
    const screenshots = getScreenshots(index);
    const videos = getVideos(index);
    return { screenshots, videos, onThisDay: getOnThisDay(index) };
  }, [index]);

  const places = useMemo(() => {
    const reviewed = new Set<string>([...keepIds, ...liked, ...trashed]);
    return buildPlaceStories(index, locations, MIN_PLACE_PHOTOS, reviewed);
  }, [index, locations, keepIds, liked, trashed]);

  const dateById = useMemo(() => new Map(index.map((a) => [a.id, a.creationTime])), [index]);

  function placeSubtitle(story: FeedStory): string {
    const when = new Date(dateById.get(story.ids[0]) ?? Date.now()).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const left = story.ids.length < story.total ? `${story.ids.length} left` : `${story.total} photos`;
    return `${left} · ${when}`;
  }

  function openPlace(story: FeedStory) {
    if (!gateSessionStart()) return;
    useFeedStore.getState().setPendingStory({ title: story.title, ids: story.ids });
    router.push('/review/story');
  }

  const randomLabel = `Random ${displayBatchSize}`;
  const screenshotsProgress = ratio(stacks.screenshots, keepIds);
  const videosProgress = ratio(stacks.videos, keepIds);
  const monthDay = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <View>
      <View className="flex-row flex-wrap gap-3 mb-6">
        <CategoryTile
          label={randomLabel}
          subtitle="Quick 5-min session"
          icon="shuffle"
          count={index.length}
          coverUri={index[0]?.uri}
          width={TILE_WIDTH}
          disabled={!isIndexing && index.length === 0}
          loading={isIndexing && index.length === 0}
          onPress={() =>
            startCategoryReview('random', { label: randomLabel, count: index.length, indexing: isIndexing })
          }
        />
        <CategoryTile
          label="Screenshots"
          subtitle={`${Math.round(screenshotsProgress * 100)}% reviewed`}
          icon="phone-portrait-outline"
          count={stacks.screenshots.length}
          coverUri={stacks.screenshots[0]?.uri}
          width={TILE_WIDTH}
          disabled={!isIndexing && stacks.screenshots.length === 0}
          loading={isIndexing && stacks.screenshots.length === 0}
          onPress={() =>
            startCategoryReview('screenshots', {
              label: 'Screenshots',
              count: stacks.screenshots.length,
              progress: screenshotsProgress,
              indexing: isIndexing,
            })
          }
        />
        <CategoryTile
          label="Videos"
          subtitle={`${formatBytes(stacks.videos.length * AVG_VIDEO_SIZE_BYTES, 0)} total`}
          icon="videocam"
          count={stacks.videos.length}
          coverUri={stacks.videos[0]?.uri}
          width={TILE_WIDTH}
          disabled={!isIndexing && stacks.videos.length === 0}
          loading={isIndexing && stacks.videos.length === 0}
          onPress={() =>
            startCategoryReview('videos', {
              label: 'Videos',
              count: stacks.videos.length,
              progress: videosProgress,
              indexing: isIndexing,
            })
          }
        />
        {/* Opens the year-by-year screen (no longer a tab), not a session */}
        <CategoryTile
          label="On This Day"
          subtitle={`Memories from ${monthDay}`}
          icon="sparkles"
          count={stacks.onThisDay.length}
          coverUri={stacks.onThisDay[0]?.uri}
          width={TILE_WIDTH}
          onPress={() => router.push('/on-this-day')}
        />
      </View>

      <View className="flex-row items-baseline justify-between mb-3">
        <Text className="text-white text-[19px] font-bold" style={{ letterSpacing: -0.3 }}>
          Places
        </Text>
        <Text className="text-white/40 text-[13px] font-medium">On your iPhone</Text>
      </View>
      {places.length > 0 ? (
        places.map((story) => (
          <MonthRow
            key={story.key}
            monthKey={story.key}
            label={story.title}
            count={story.total}
            subtitle={placeSubtitle(story)}
            progress={(story.total - story.ids.length) / story.total}
            isComplete={false}
            coverUri={story.coverUri}
            onPress={() => openPlace(story)}
          />
        ))
      ) : (
        <Text className="text-white/45 text-[14px] leading-5">
          {!isPhotoAnalyzerAvailable()
            ? 'Places need photo locations, which this device can’t read.'
            : scanning
              ? 'Finding places in your photos…'
              : 'Photos taken with Location turned on are grouped by trip here.'}
        </Text>
      )}
    </View>
  );
}
