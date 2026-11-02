import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { isPhotoAnalyzerAvailable, PhotoAnalyzer } from 'expo-photo-analyzer';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

function loadIds(key: string): string[] {
  const raw = storage.getString(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: Iterable<string>): void {
  storage.set(key, JSON.stringify(Array.from(ids)));
}

/** A story the user tapped, handed to the review screen (not persisted). */
export interface PendingStory {
  title: string;
  ids: string[];
}

interface FeedState {
  /** Photos liked in the feed — a like only marks the photo */
  liked: Set<string>;
  /** Photos disliked in the feed, waiting in Trash, oldest first */
  trashed: string[];
  /** Stories already opened — their ring turns grey */
  seenStories: Set<string>;
  pendingStory: PendingStory | null;
  /** Favorites in the iOS Photos app (the feed's bookmark), read from PhotoKit */
  favorites: Set<string>;

  toggleLike: (id: string) => void;
  loadFavorites: (ids: string[]) => Promise<void>;
  /** Writes to iOS Favorites; rolls back and rethrows if Photos refuses */
  toggleFavorite: (id: string) => Promise<void>;
  trash: (id: string) => void;
  /** Takes photos out of Trash (deleted, or restored to the feed) */
  removeFromTrash: (ids: string[]) => void;
  markStorySeen: (key: string) => void;
  setPendingStory: (story: PendingStory | null) => void;
}

export const useFeedStore = create<FeedState>()(
  immer((set, get) => ({
    liked: new Set(loadIds(STORAGE_KEYS.feedLiked)),
    trashed: loadIds(STORAGE_KEYS.feedTrash),
    seenStories: new Set(loadIds(STORAGE_KEYS.feedSeenStories)),
    pendingStory: null,
    favorites: new Set(),

    loadFavorites: async (ids) => {
      if (!isPhotoAnalyzerAvailable() || ids.length === 0) return;
      const favs = await PhotoAnalyzer.getFavoriteIds(ids);
      set((s) => {
        s.favorites = new Set(favs);
      });
    },

    toggleFavorite: async (id) => {
      if (!isPhotoAnalyzerAvailable()) return;
      const next = !get().favorites.has(id);
      const apply = (on: boolean) =>
        set((s) => {
          if (on) s.favorites.add(id);
          else s.favorites.delete(id);
        });
      apply(next); // optimistic — the icon fills at once
      try {
        await PhotoAnalyzer.setFavorite([id], next);
      } catch (e) {
        apply(!next);
        throw e;
      }
    },

    toggleLike: (id) =>
      set((s) => {
        if (s.liked.has(id)) s.liked.delete(id);
        else s.liked.add(id);
        saveIds(STORAGE_KEYS.feedLiked, s.liked);
      }),

    trash: (id) =>
      set((s) => {
        if (s.trashed.includes(id)) return;
        s.trashed.push(id);
        saveIds(STORAGE_KEYS.feedTrash, s.trashed);
      }),

    removeFromTrash: (ids) =>
      set((s) => {
        const drop = new Set(ids);
        s.trashed = s.trashed.filter((id) => !drop.has(id));
        saveIds(STORAGE_KEYS.feedTrash, s.trashed);
      }),

    markStorySeen: (key) =>
      set((s) => {
        s.seenStories.add(key);
        saveIds(STORAGE_KEYS.feedSeenStories, s.seenStories);
      }),

    setPendingStory: (story) =>
      set((s) => {
        s.pendingStory = story;
      }),
  })),
);
