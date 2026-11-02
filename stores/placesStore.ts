import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { isPhotoAnalyzerAvailable, PhotoAnalyzer } from 'expo-photo-analyzer';
import { STORAGE_KEYS } from '@/constants/config';

const storage = createMMKV();

// Ids per native call — one fetch per chunk keeps the bridge payload small
const CHUNK = 2000;

/** [latitude, longitude] per asset id */
export type LocationMap = Record<string, [number, number]>;

function load<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface PlacesState {
  locations: LocationMap;
  /** Ids already looked up (with or without a location) — never re-read */
  checked: Set<string>;
  scanning: boolean;
  /** Reads GPS for the given ids that haven't been checked yet, on device. */
  scan: (ids: string[]) => Promise<void>;
}

export const usePlacesStore = create<PlacesState>()((set, get) => ({
  locations: load<LocationMap>(STORAGE_KEYS.placeLocations, {}),
  checked: new Set(load<string[]>(STORAGE_KEYS.placeChecked, [])),
  scanning: false,

  scan: async (ids) => {
    if (get().scanning || !isPhotoAnalyzerAvailable()) return;
    const { checked } = get();
    const todo = ids.filter((id) => !checked.has(id));
    if (todo.length === 0) return;

    set({ scanning: true });
    const locations = { ...get().locations };
    const nextChecked = new Set(checked);
    try {
      for (let i = 0; i < todo.length; i += CHUNK) {
        const chunk = todo.slice(i, i + CHUNK);
        const found = await PhotoAnalyzer.getAssetLocations(chunk);
        for (const loc of found) locations[loc.id] = [loc.latitude, loc.longitude];
        for (const id of chunk) nextChecked.add(id);
      }
      storage.set(STORAGE_KEYS.placeLocations, JSON.stringify(locations));
      storage.set(STORAGE_KEYS.placeChecked, JSON.stringify(Array.from(nextChecked)));
      set({ locations, checked: nextChecked });    } finally {
      set({ scanning: false });
    }
  },
}));
