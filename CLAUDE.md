# Swipe Photos — Claude Reference

## Running the App

**Expo Go will not work.** MMKV, Skia, and Lottie require native code. Use Expo Dev Client:
- **Build + install once:** `npx expo run:ios --device`
- **Hot reload after that:** `npx expo start` (Dev Client app on device picks it up)
- **NativeWind v4 babel setup:** `jsxImportSource: 'nativewind'` on `babel-preset-expo` — NOT a separate `nativewind/babel` plugin entry.
- **`react-native-mmkv` v4 requires `react-native-nitro-modules`** as a peer dependency — install it explicitly, then rebuild native.

---

## Hard Rules

### Styling: NativeWind only — never `StyleSheet.create`
```tsx
// ✅
<View className="flex-1 bg-black px-6">
  <Text className="text-white text-3xl font-bold">Title</Text>
</View>

// ❌
const styles = StyleSheet.create({ container: { flex: 1 } });
```
**Allowed exceptions for `style` prop:**
- `useAnimatedStyle` from Reanimated (animated styles must be JS objects)
- Dynamic values that can't be Tailwind classes (computed pixel offsets, etc.)
- Navigator config props (`tabBarStyle`, `tabBarBackground`, etc.)

Mix both when needed: `className` for static, `style` for animated/dynamic.

### No custom native modules
All functionality via Expo SDK only. If a gap exists, adjust the UX — don't write native code.

### Glass UI is mandatory, not optional
Every screen uses `GlassCard`, `BlurPanel`, or `GlassSheet` from `components/glass/`. No plain white/gray surfaces.

### Commit discipline
Every commit leaves the app in a runnable state. Convention: `feat:` / `fix:` / `chore:` / `refactor:` / `docs:`

---

## API Gotchas

### Immer requires `enableMapSet()` for Set/Map support
Immer doesn't support `Set` or `Map` mutations by default. `enableMapSet()` must be called once at app startup (in `app/_layout.tsx`) before any store that uses `Set` is accessed. Without it, `state.staged.add()` throws at runtime.
```ts
import { enableMapSet } from 'immer';
enableMapSet(); // call at module level in _layout.tsx
```

### Zustand selectors must return stable values
Never put derived-state methods in a Zustand store — they return new object references every call, causing infinite re-render loops. Keep stores as flat state + actions only. Compute derived values in components with `useMemo`.
```ts
// ❌ Infinite loop — new object reference every call
const counts = useStore((s) => s.getCounts());

// ✅ Stable — useMemo recomputes only when index changes
const index = useStore((s) => s.index);
const counts = useMemo(() => computeCounts(index), [index]);
```

### MMKV v4 — `createMMKV()`, not `new MMKV()`
`MMKV` is a type-only export in v4. Use the factory:
```ts
import { createMMKV } from 'react-native-mmkv';
const storage = createMMKV();
```

### MMKV cannot store `Set` — serialize manually
```ts
// Write
storage.set(key, JSON.stringify(Array.from(mySet)));
// Read
new Set<string>(JSON.parse(storage.getString(key) ?? '[]'));
```

### `deleteAssetsAsync` shows an iOS system confirmation dialog — this is correct
`expo-media-library`'s delete triggers a native iOS alert ("Delete X Photos?"). This is required by Apple and moves photos to Recently Deleted (30-day recovery). Do not attempt to suppress or work around it. Our trash screen is the pre-confirmation; the system dialog is the final safety net.

### Favorites = iOS smart album
```ts
const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
const favAlbum = albums.find(a => a.title === 'Favorites');
```

### Spring and swipe constants live in `constants/theme.ts`
Never hardcode spring configs or swipe thresholds. Always use `SPRING.*` and `SWIPE.*` from `theme.ts`.

---

## Library Choices (non-negotiable)

| Need | Use | Never use |
|---|---|---|
| Styling | NativeWind `className` | `StyleSheet.create` |
| Images | `expo-image` | `Image` from react-native |
| Storage | `react-native-mmkv` (`createMMKV`) | `AsyncStorage` |
| Navigation | `expo-router` | `@react-navigation/*` directly |
| Animations | `react-native-reanimated` worklets | JS-thread animations |
| Global state | `zustand` | Context, Redux |
| Async gallery queries | `@tanstack/react-query` (`useQuery` only) | `useEffect` + `useState` for async fetching |

---

## Quality Gates (run before every commit)

```bash
npm run lint       # ESLint — patterns, restricted APIs
npm run typecheck  # tsc --noEmit — type errors (ESLint does NOT catch these)
```
Both must pass clean.
