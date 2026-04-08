# SwipeClean — Project Rules for Claude

## Styling: NativeWind Only

**Always use NativeWind `className` prop for styling. Never use `StyleSheet.create`.**

```tsx
// ✅ Correct
<View className="flex-1 bg-black px-4 pt-12">
  <Text className="text-white text-3xl font-bold">Title</Text>
</View>

// ❌ Wrong
const styles = StyleSheet.create({ container: { flex: 1 } });
<View style={styles.container} />
```

**Exceptions where `style` prop is allowed:**
1. `useAnimatedStyle` from Reanimated — animated styles must use `style` prop
2. Dynamic JS values that can't be expressed as Tailwind classes (e.g. computed pixel offsets)
3. `StyleSheet.absoluteFill` — replace with `className="absolute inset-0"` instead

When both are needed, use `className` for static styles and `style` for dynamic/animated:
```tsx
<Animated.View className="absolute rounded-3xl overflow-hidden" style={animatedStyle} />
```

## Architecture

- **Expo Router** for all navigation (file-based routes in `app/`)
- **Zustand** for all global state (`stores/`)
- **MMKV v4** for persistence (not AsyncStorage) — use `createMMKV()` factory, not `new MMKV()`. `MMKV` is a type-only export in v4.
- **TanStack Query** for async data fetching
- **Reanimated 3/4** for all animations — worklets only, never JS-thread animations
- **No custom native modules** — use Expo SDK APIs

## Component Rules

- Glass components live in `components/glass/` — use `GlassCard`, `BlurPanel`, `GlassSheet`
- All interactive elements must have haptic feedback via `expo-haptics`
- All press animations use Reanimated spring scale (not opacity-only)
- Use `expo-image` (not `Image` from react-native) for all photo rendering

## Checking Errors

- **`npm run lint`** — ESLint: catches code patterns, style issues, restricted APIs
- **`npm run typecheck`** — `tsc --noEmit`: catches TypeScript type errors (TS2693, TS2820, etc.)
- ESLint does NOT catch TypeScript type errors by default. Always run both before committing.

## Code Style

- TypeScript strict mode — no `any`, no `@ts-ignore`
- No `console.log` in committed code
- No unused imports
- Prefer named exports over default exports for components (exception: Expo Router route files require default export)

## Commit Convention

```
feat: add new user-facing feature
fix: correct a bug
chore: config, tooling, deps
docs: documentation only
refactor: restructure without behavior change
```

## What NOT to do

- No `StyleSheet.create` for static styles
- No `AsyncStorage` (use MMKV)
- No `react-navigation` imports directly (use `expo-router`)
- No `Image` from react-native (use `expo-image`)
- No premature abstractions — build it when needed the third time
- No `console.log` in committed code
