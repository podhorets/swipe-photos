import { useEffect, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useGalleryStore } from '@/stores/galleryStore';
import {
  buildIndex,
  loadCachedIndex,
  applyIndexDelta,
} from '@/lib/gallery/indexer';

/**
 * Bootstraps the gallery index on mount and subscribes to library changes.
 * Call once — in the tabs layout so indexing starts immediately on app open.
 */
export function useGalleryIndex() {
  const { setIndex, setIndexing, applyDelta } = useGalleryStore();
  // Prevent double-indexing on StrictMode double-mount
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    async function init() {
      // 1. Hydrate from cache immediately — instant UI
      const cached = loadCachedIndex();
      if (cached.length > 0) {
        setIndex(cached);
      }

      // 2. Background full rebuild
      setIndexing(true, 0);
      const fresh = await buildIndex((loaded, total) => {
        setIndexing(true, total > 0 ? loaded / total : 0);
      });
      setIndex(fresh);
    }

    init();
  }, [setIndex, setIndexing]);

  useEffect(() => {
    // Subscribe to library changes for incremental updates
    const subscription = MediaLibrary.addListener((event) => {
      const current = useGalleryStore.getState().index;

      if (!event.hasIncrementalChanges) {
        // Full change — trigger a rebuild
        buildIndex().then((fresh) => useGalleryStore.getState().setIndex(fresh));
        return;
      }

      const updated = applyIndexDelta(current, event);
      applyDelta(updated);
    });

    return () => subscription.remove();
  }, [applyDelta]);
}
