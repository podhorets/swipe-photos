# Handoff: Swipe Photos — Liquid Glass Redesign

## Overview
A visual redesign of the Swipe Photos iOS app (Expo / React Native photo-cleanup app: swipe left to delete, right to keep). The redesign — "Liquid Glass, photo-forward" — is an evolution of the app's existing dark glassmorphism theme: ambient aurora backgrounds, photo-rich category tiles, a hero storage ring, floating glass pill tab bar, and richer review/trash/completion screens. All 8 screens are covered.

## About the Design Files
The files in this bundle are **design references created in HTML** (`Swipe Photos.dc.html`, viewable in a browser; `ios-frame.jsx` is its device-bezel dependency). They are prototypes showing intended look — **not production code to copy**. The task is to **recreate these designs in the existing swipe-photos codebase**: Expo + expo-router, NativeWind v4 (`className` only, never `StyleSheet.create`), `expo-image`, Reanimated worklets, zustand, `GlassCard`/`BlurPanel`/`GlassSheet` from `components/glass/`. Follow the repo's `CLAUDE.md` hard rules.

The HTML contains two labeled sections:
- **1b — Redesign** (implement this)
- **1a — Current UI recreation** (reference: what exists today, for diffing)

## Fidelity
**High-fidelity.** Colors, spacing, radii, and typography in section 1b are final. Recreate pixel-perfectly using NativeWind + the existing glass components. Photos are placeholders (picsum.photos) — real screens use the user's library via `expo-image`.

## Design Tokens (map into `constants/theme.ts` + `tailwind.config.js`)

Colors:
- Background: `#050508` (replaces `#000000`), always with 1–2 ambient radial glow blobs:
  - violet: `radial-gradient(circle, rgba(94,92,230,0.30), transparent 65%)`, ~440px circle, offset off-screen top-left
  - blue: `radial-gradient(circle, rgba(10,132,255,0.20), transparent 65%)`, offset off-screen right
  - red variant for Trash: `rgba(255,69,58,0.16)`; green for Session Complete: `rgba(48,209,88,0.22)`
- Accent: `#0A84FF` (unchanged). Accent gradient: `linear-gradient(135deg, #0A84FF, #5E5CE6)`
- Keep green `#30D158`, delete red `#FF453A` (unchanged). Delete gradient: `linear-gradient(135deg, #FF453A, #FF6482)`
- Streak amber: `#FF9F0A`
- Glass surface: `rgba(255,255,255,0.06–0.07)`; border `rgba(255,255,255,0.11–0.14)`; top-edge highlight `rgba(255,255,255,0.24–0.28)`; blur 24–28 with `saturate(160%)`
- Text: primary `#FFFFFF`; secondary `rgba(255,255,255,0.45–0.55)`; tertiary `rgba(255,255,255,0.35–0.40)`

Typography (SF Pro / system):
- Large titles: 34px, weight 800, letter-spacing −0.8px
- Card titles: 16px w700; section labels: 12px w700 uppercase, letter-spacing 0.12em
- Hero numbers: 22–24px w800; giant stat (freed GB): 56px w800, letter-spacing −2px, gradient text `#30D158 → #64D2FF`

Radii: large cards 28, cards 22–24, thumbs 15–16, icon squircles 9 (30×30px), pills/buttons 999.
Spacing: screen padding 20px; card gaps 10–14px; grid gaps 8–12px.

## Screens

### 1. Onboarding (`app/onboarding.tsx`)
- Replaces the emoji hero with a **fanned photo-card stack**: three 160×214 rounded-22 photos rotated −10°/0°/+9°, 1px white borders (opacity .25–.35), large drop shadows; a 52px green check circle (bottom-right, `rgba(48,209,88,0.92)`, glow shadow) and 44px red trash circle (bottom-left).
- Title 40px w800 −1px; subtitle 17px `rgba(255,255,255,0.55)`, max-width 300.
- Progress dots: active 26×6 gradient pill, inactive 6×6 `rgba(255,255,255,0.25)`.
- CTA: full-width pill (radius 999), accent gradient, 17px w700 white, shadow `0 12px 32px rgba(10,132,255,0.35)`.
- Violet + blue aurora glows behind everything.

### 2. Home / Library (`app/(tabs)/index.tsx`) — restructured
- Header: date line ("Monday, July 6", 14px, 50% white) over "Your Library" (34/800/−0.8). Top-right: streak chip — 🔥 + count, pill with `rgba(255,159,10,0.15)` bg + `rgba(255,159,10,0.3)` border, amber text.
- **Hero storage card** (glass, radius 28, padding 16): left = SVG ring 104×104 (r 44, stroke 9; track `rgba(255,255,255,0.1)`; progress stroke = accent gradient, round caps, dasharray 276.5, animated dashoffset; center "32%" 21px w800 + "REVIEWED" 10px). Right = "12,847 items" 22/800, meta line 13px 45%, plus green line with sparkles icon: "4.6 GB freed all-time".
- **Week strip** (glass, radius 20, padding 10×16): "This week" label left; 7 day columns right — 10px letter + 18px dot (complete: solid `#FF9F0A` with dark check; today: 1.5px white/40 ring; else `rgba(255,255,255,0.08)`).
- **Category grid 2×2** (gap 12): each tile 122px tall, radius 24, full-bleed photo + scrim `linear-gradient(180deg, rgba(5,5,8,0.15), rgba(5,5,8,0.82))`, 1px white/14 border. Count pill top-right (blurred `rgba(5,5,8,0.55)`). Bottom-left: 20px icon, label 16/700, subtitle 12px white/60. Tiles: On This Day, Screenshots, Videos, Random 50.
- **Browse by month** wide glass row: 46px gradient icon squircle (radius 15) + title/subtitle + chevron.
- **Floating pill tab bar** replaces the full-width bar (see Shared Chrome).

### 3. Review session (`app/review/[sessionId].tsx`)
- Background: the current photo, scaled +80px overflow, `blur(60px) brightness(0.4) saturate(1.4)`, opacity 0.7 — an ambient echo. Cross-fade ~200ms when top card changes.
- Top chrome: 40px glass circles (close left, undo right — `rgba(24,24,28,0.6)` + blur + 1px white/16 border); centered title 16/700 + "247 of 763 left" 12px white/55.
- Progress: 4px bar, track `rgba(255,255,255,0.14)`, fill = accent gradient.
- Card: 346×580, radius 32, 1px white/25 border, shadow `0 32px 80px rgba(0,0,0,0.6)`. Bottom scrim 110px; metadata chips bottom-left (blurred dark pills, 12px w600): date chip with calendar icon, file-size chip. Next card peeks behind (scale 0.94, +18px y, opacity 0.6).
- Action bar: two 64px glass circles — delete (`rgba(255,69,58,0.18)` bg, 1.5px `rgba(255,69,58,0.5)` border, filled trash icon `#FF453A`, red glow shadow) and keep (same in green, filled heart `#30D158`). Between them: "SWIPE OR TAP" 11px w600 tracking 0.08em white/40.
- Keep existing gesture thresholds and springs (`SWIPE.*`, `SPRING.*`) exactly.

### 4. By Month (`app/(tabs)/by-month.tsx`)
- Title block, then **year group headers** ("2026", 13px w700 tracking 0.1em white/40).
- Rows (glass radius 24, padding 12): 62px photo thumbnail (radius 16) + label 16/700 + "N items" 13px. Right side: done → 30px green check circle (`rgba(48,209,88,0.18)` bg, 1.5px green/60 border); in progress → 34px mini SVG ring (r 14, stroke 3.5, dasharray 88, accent stroke) with % number centered.

### 5. On This Day (`app/(tabs)/on-this-day.tsx`)
- Most recent year becomes a **hero card**: 300px tall, radius 28, full-bleed photo, scrim to `rgba(5,5,8,0.85)`; bottom-left "1 YEAR AGO" 13px w600 → "2025" 26/800 → "12 photos"; bottom-right solid-white "Review" pill with play icon.
- Older years: header row (year 19/800 + meta 13px + accent "Review" text link right) over horizontal strip of 104×130 radius-16 thumbs (1px white/10 borders), 8px gaps.

### 6. Settings (`app/(tabs)/settings.tsx`)
- Grouped glass cards (radius 22). Every row gets a **30×30 radius-9 gradient icon squircle** with white filled icon:
  - shuffle: accent gradient · Face ID: `#30D158→#64D2FF` · Analytics: `#BF5AF2→#5E5CE6` · notifications: `#FF9F0A→#FF6482` · star: `#FF9F0A→#FFD60A` · shield: `#64D2FF→#0A84FF` · info: `rgba(255,255,255,0.14)`
- Batch size becomes a segmented control: container radius 14 on `rgba(0,0,0,0.35)`, 4px padding; selected segment `rgba(255,255,255,0.16)` + 0.5px white/20 border, radius 11.
- iOS switches unchanged (`#30D158` on-track).

### 7. Trash (`app/trash.tsx`)
- Header: 40px glass back circle; "Trash" 24/800; subtitle "Last check before deleting — tap to keep instead"; accent "Deselect all" text right.
- Grid: 3 columns, **8px gaps**, radius 16, screen-padded (no full-bleed). Selected: 2px `rgba(255,69,58,0.85)` ring + 22px red check circle top-right. Deselected: `rgba(5,5,8,0.68)` overlay with centered green "Kept" chip (heart icon, `rgba(48,209,88,0.2)` bg, green/50 border).
- Bottom: floating glass bar (radius 24, blurred `rgba(24,24,28,0.72)`) over a fade-out gradient — left: "12 selected" 15/700 + "~1.2 GB will be freed" 12px; right: Delete pill, red gradient, lock icon when Face ID enabled, shadow `0 10px 26px rgba(255,69,58,0.35)`.

### 8. Session complete (replaces `SessionCompleteSheet` bottom sheet with a full screen)
- Green radial glow centered top. 84px check circle (green/15 bg, 1.5px green/50 border, `0 0 60px rgba(48,209,88,0.3)` glow).
- "All done!" 32/800 → "You reviewed 50 photos" 15px.
- Hero: freed size 56px w800 gradient text (`#30D158→#64D2FF`) + "storage freed" 15/600. Animate with a count-up.
- Three stat cards (glass radius 20): Kept / Deleted / 🔥 Day streak (amber value).
- CTA: accent-gradient pill "Back to Library". Below: suggestion line "Keep going — Screenshots has 247 left" 14px white/40.

## Shared Chrome: floating pill tab bar (`app/(tabs)/_layout.tsx`)
Replaces the full-width absolute blur bar. Centered, ~26px above bottom:
- Container: pill, 6px padding, `rgba(24,24,28,0.72)` + blur 28 saturate 160%, 1px white/14 border (top highlight white/28), shadow `0 16px 40px rgba(0,0,0,0.5)`.
- 4 tabs, each a pill (10px × 16px padding): active = `rgba(255,255,255,0.14)` bg + 20px filled icon + 13px w700 label; inactive = icon only, `rgba(255,255,255,0.45)`.
- Tab labels renamed in the bar only: Library, Months, Memories, Settings. Icons switch from outline to filled variants (images, calendar-number, sparkles, settings-sharp).
- Animate the active pill with a layout spring (`SPRING.press`).

## Interactions & Behavior
- All existing behavior is unchanged — this is a visual redesign. Keep stores, hooks, navigation, haptics, Face ID gates, and the native delete dialog as-is.
- Keep `SPRING.*` and `SWIPE.*` constants exactly; do not invent new spring configs.
- Rings (storage, month progress): animate stroke-dashoffset on mount, ~800ms ease-out.
- Review ambient bg: 200ms cross-fade between photos.
- Session complete: count-up on freed GB; existing Lottie confetti optional.

## State Management
No changes. All data shown exists in current stores (`galleryStore`, `keepStore`, `statsStore`, `streakStore`, `sessionStore`, `settingsStore`). New derived values: % of library reviewed (keepIds ÷ index length) for the hero ring; "oldest month" label for the Browse by month row.

## Assets
- Photos in the mocks are picsum.photos placeholders — production uses library assets via `expo-image`.
- Icons are Ionicons (already in the codebase via `@expo/vector-icons`); redesign uses **filled** variants in tab bar/action buttons, outline elsewhere as specified per screen.
- Aurora glows: absolutely-positioned radial gradients (expo-linear-gradient or Skia), not blur views.

## Files
- `Swipe Photos.dc.html` — the design. Open in a browser. Section **1b** = redesign (implement); section **1a** = current UI recreation (reference). All values are inline styles — read them directly for exact px/rgba values.
- `ios-frame.jsx` — iPhone bezel used by the HTML preview; not part of the design itself.

## Suggested implementation order (one commit per step)
1. Tokens: `constants/theme.ts` + `tailwind.config.js`
2. Shared chrome: floating pill tab bar (`_layout.tsx`)
3. Home → Review → By Month → On This Day → Settings → Trash → Session complete → Onboarding
Run `npm run lint && npm run typecheck` before each commit.
