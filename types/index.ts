import * as MediaLibrary from 'expo-media-library';

// ─── Asset ───────────────────────────────────────────────────────────────────

export interface AssetMeta {
  id: string;
  uri: string;
  filename: string;
  mediaType: MediaLibrary.MediaTypeValue;
  // iOS native subtypes — includes 'screenshot', 'livePhoto', 'panorama', etc.
  mediaSubtypes: MediaLibrary.MediaSubtype[];
  creationTime: number; // Unix ms
  modificationTime: number; // Unix ms
  duration: number; // seconds (0 for photos)
  width: number;
  height: number;
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

export type Category =
  | 'year'
  | 'month'
  | 'on-this-day'
  | 'screenshots'
  | 'videos'
  | 'random'
  | 'similar';

export interface CategoryInfo {
  id: Category;
  label: string;
  icon: string; // Ionicons name
  count: number;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type SwipeDirection = 'left' | 'right';
export type SwipeDecision = 'delete' | 'keep';

export interface Session {
  id: string;
  category: Category;
  label: string; // e.g. "2023", "January 2024", "On This Day"
  assetIds: string[];
  createdAt: number;
  // 'similar' sessions only: asset ids per duplicate group, in review order.
  // assetIds is the flat concatenation of these groups.
  groups?: string[][];
}

