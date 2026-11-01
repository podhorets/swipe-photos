import { useEffect, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useGalleryStore } from '@/stores/galleryStore';
import { usePermissions } from '@/hooks/usePermissions';
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
  // Re-read when the app returns to the foreground — i.e. after the iOS prompt
  // or the Settings app — so a later grant starts indexing without a relaunch
  const { isMediaGranted } = usePermissions();
  // Prevent double-indexing on StrictMode double-mount
  const didInit = useRef(false);

  useEffect(() => {
    // Without access every MediaLibrary read rejects; wait for the grant
    // instead of raising the prompt implicitly from a background fetch
    if (!isMediaGranted || didInit.current) return;
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

    init().catch(() => {
      // Access revoked mid-build — allow a retry on the next grant
      didInit.current = false;
      setIndexing(false, 0);
    });
  }, [isMediaGranted, setIndex, setIndexing]);

  useEffect(() => {
    // Subscribe to library changes for incremental updates
    const subscription = MediaLibrary.addListener((event) => {
      const current = useGalleryStore.getState().index;

      if (!event.hasIncrementalChanges) {
        // Full change — trigger a rebuild
        buildIndex()
          .then((fresh) => useGalleryStore.getState().setIndex(fresh))
          .catch(() => {});
        return;
      }

      const updated = applyIndexDelta(current, event);
      applyDelta(updated);
    });

    return () => subscription.remove();
  }, [applyDelta]);
}
