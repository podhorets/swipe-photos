// MMKV storage keys
export const STORAGE_KEYS = {
  galleryIndex: 'gallery:index',
  favoriteIds: 'gallery:favoriteIds',
  deletionStaged: 'deletion:staged',
  settings: 'settings',
  hasCompletedOnboarding: 'onboarding:completed',
};

// Gallery indexing
export const GALLERY = {
  // Assets fetched per page during indexing
  pageSize: 500,
  // Default batch size for Random Review
  defaultBatchSize: 50,
  // Screenshot detection: common iPhone screen dimensions (width × height)
  screenshotDimensions: [
    { w: 430, h: 932 },  // iPhone 14 Pro Max / 15 Plus
    { w: 393, h: 852 },  // iPhone 14 Pro / 15
    { w: 390, h: 844 },  // iPhone 12/13/14
    { w: 428, h: 926 },  // iPhone 12/13 Pro Max
    { w: 414, h: 896 },  // iPhone 11 / XR / XS Max
    { w: 375, h: 812 },  // iPhone X / XS / 11 Pro
    { w: 320, h: 568 },  // iPhone SE (1st gen)
    { w: 375, h: 667 },  // iPhone 6/7/8 / SE (2nd/3rd gen)
  ],
};

// Session config
export const SESSION = {
  // Max undo stack depth
  maxUndo: 10,
  // Undo pill visible duration (ms)
  undoPillDuration: 3000,
  // Cards preloaded ahead of current
  preloadAhead: 5,
};

// Estimated average photo size for "reclaimable" display
export const AVG_PHOTO_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
export const AVG_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
