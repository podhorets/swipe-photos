import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS, GALLERY } from '@/constants/config';

const storage = createMMKV();

// ─── Persistence ──────────────────────────────────────────────────────────────

interface Settings {
  faceIdEnabled: boolean;
  batchSize: number;
  notificationsEnabled: boolean;
  analyticsOptIn: boolean;
  // Similar review: tap thumbnails to star MULTIPLE keepers (true) or to
  // replace the single best (false). Toggleable from the review header.
  multiBest: boolean;
}

const DEFAULTS: Settings = {
  faceIdEnabled: false,
  batchSize: GALLERY.defaultBatchSize,
  notificationsEnabled: false,
  analyticsOptIn: true,
  multiBest: true,
};

function loadSettings(): Settings {
  const raw = storage.getString(STORAGE_KEYS.settings);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) as Partial<Settings> };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: Settings) {
  storage.set(STORAGE_KEYS.settings, JSON.stringify(s));
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface SettingsState extends Settings {
  setFaceIdEnabled: (value: boolean) => void;
  setBatchSize: (value: number) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setAnalyticsOptIn: (value: boolean) => void;
  setMultiBest: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...loadSettings(),

  setFaceIdEnabled: (value) => {
    set({ faceIdEnabled: value });
    saveSettings({ ...get() });
  },

  setBatchSize: (value) => {
    set({ batchSize: value });
    saveSettings({ ...get() });
  },

  setNotificationsEnabled: (value) => {
    set({ notificationsEnabled: value });
    saveSettings({ ...get() });
  },

  setAnalyticsOptIn: (value) => {
    set({ analyticsOptIn: value });
    saveSettings({ ...get() });
  },

  setMultiBest: (value) => {
    set({ multiBest: value });
    saveSettings({ ...get() });
  },
}));
