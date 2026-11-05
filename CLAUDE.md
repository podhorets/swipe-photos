# Swipe Photos — Claude Reference

## Running the App

**Expo Go will not work.** MMKV, Skia, and Lottie require native code. Use Expo Dev Client:
- **Build + install once:** `npx expo run:ios --device`
- **Hot reload after that:** `npx expo start` (Dev Client app on device picks it up)
- **NativeWind v4 babel setup:** `jsxImportSource: 'nativewind'` on `babel-preset-expo` — NOT a separate `nativewind/babel` plugin entry.
- **`react-native-mmkv` v4 requires `react-native-nitro-modules`** as a peer dependency — install it explicitly, then rebuild native.
- **Seed a simulator photo library:** `npm run seed:photos -- [count] [device]` (defaults: 320, booted). Adds ~430 photos with spread-out dates, near-duplicate bursts, blurry shots, and "On This Day" matches for today. Re-running adds more; erase the simulator for a clean library.

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

### Native code
Prefer the Expo SDK and the third-party native modules already in use: `react-native-purchases` (RevenueCat, subscriptions), `react-native-mmkv`, `@shopify/react-native-skia`, `lottie-react-native`, `@sentry/react-native`.
When Expo can't do something well (or fast enough), add native code to the project's own module `modules/expo-photo-analyzer` (Swift: Apple Vision feature prints, blur, face count, bulk photo locations). This module is owned and edited here — it started as a copy of cleani's module but no longer has to match it. After changing Swift, rebuild the native app (Fast Refresh doesn't pick it up). Every call site must check `isPhotoAnalyzerAvailable()` and degrade gracefully (iOS-only module).

### Theme: Light ("Mist") and Dark ("Night Sky") — follow the design, not glass
The design lives on the Claude Design canvas (rows "Light primary" / "Dark primary") and in `docs/design/handoff/DESIGN_HANDOFF.md`. Solid cards, no frosted glass, no glows, no blue→violet gradients.
- **Colours only through tokens.** Values live in `constants/colors.ts` (`light` / `dark`); classes like `bg-card`, `text-fg-2`, `border-hairline`, `bg-tile-blue` resolve to CSS variables, so a `className` is the same in both themes. Props that can't take a class (icon `color`, gradients, `boxShadow`, Switch) use `useTheme()` from `lib/theme/ThemeProvider`.
- **Never** `text-white`, `bg-black`, `bg-white/10`, hex/rgba literals or `dark:` variants in screens. No alpha modifiers on tokens (`bg-fg/10`) — the variables hold full colours. On photos use `text-on-photo` / `text-on-photo-2`, `bg-chip` and `ON_PHOTO` (same in both themes).
- **New tokens** go in `constants/colors.ts` (`Theme` + `TOKENS`) *and* the `THEME_TOKENS` list in `tailwind.config.js`.
- **Green and red only mean keep and delete.** Toggles and selected states use accent.
- **Feed and the photo preview are always dark** on pure black: wrap them in `<ThemeScope mode="dark">` and call `useStatusBarStyle('light')`. Feel like Instagram without copying it: no Instagram logo, wordmark, exact gradient, or Instagram-only icons (Guidelines 4.1 / 5.2.1).
- **Display face:** `font-display` (Nunito ExtraBold) for titles and big numbers; never add `font-bold` etc. to it (iOS falls back to the system font). Everything else is the system font.
- **Icons:** `<Icon name=… color=…/>` from `components/ui/Icon.tsx` (outline, 24 grid). Not Ionicons. Draw a missing icon there in the same style.
- **Theme context** (`useTheme`, `ThemeScope`) is the one allowed React Context: it is scoped per subtree, which a global store can't express.
- Settings › Appearance (System / Light / Dark) is `settingsStore.appearance`; `ThemeProvider` applies it with `Appearance.setColorScheme`, so native Alerts and the delete dialog follow it.

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
| Global state | `zustand` | Context (except the theme scope), Redux |
| Icons | `Icon` (`components/ui/Icon.tsx`) | `@expo/vector-icons` |
| Colours | theme tokens / `useTheme()` | hex, `white`/`black` classes, `expo-blur` glass |
| In-app purchases | `react-native-purchases` (RevenueCat) | StoreKit directly, `expo-in-app-purchases` (deprecated) |
| Async gallery queries | `@tanstack/react-query` (`useQuery` only) | `useEffect` + `useState` for async fetching |

---

## Quality Gates (run before every commit)

```bash
npm run lint       # ESLint — patterns, restricted APIs
npm run typecheck  # tsc --noEmit — type errors (ESLint does NOT catch these)
```
Both must pass clean.
