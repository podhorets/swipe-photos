# Swipe Photos — redesign handoff (Light primary + Dark primary)

This is the implementation guide for the approved redesign. It covers **visual design only**: layout, navigation, copy and behaviour stay as they are in the current app. Every screen of the current app is redesigned in two modes:

| Mode | Name | Canvas row |
|---|---|---|
| Light | **Light primary** ("Mist") | `LP-*` artboards |
| Dark | **Dark primary** ("Night Sky") | `DP-*` artboards |

Design canvas: https://claude.ai/artifact/EEYdnDUXQeDKfSxqiHMy51 (rows "Light primary" and "Dark primary", plus the "Handoff" row).

Files in this folder:

- `theme.ts` — all colour, type, radius, spacing and size tokens for both modes (the single source of truth).
- `tokens.json` — the same colour tokens as plain JSON, generated from the source the mockups render from.
- `icons.tsx` — the outline icon set (react-native-svg paths) plus an `<Icon>` component.
- `DESIGN_HANDOFF.md` — this file.

---

## 1. Setup

1. Install fonts and SVG:
   ```bash
   npx expo install @expo-google-fonts/nunito expo-font react-native-svg expo-linear-gradient
   ```
2. Load fonts at the root:
   ```ts
   import { useFonts, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
   const [loaded] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold });
   ```
   Nunito ExtraBold is the **display** face (large titles, card titles, big numbers, review-screen titles and two-line button titles). Everything else stays on the **system font** (SF Pro). SF Pro Rounded would also work on iOS. Nunito is used so the app matches the mockups and Android.
3. Add a theme provider:
   ```ts
   import { light, dark } from './theme';
   const scheme = useColorScheme();             // 'light' | 'dark'
   const theme = (userOverride ?? scheme) === 'dark' ? dark : light;
   ```
   Follow the system appearance by default. If you add an Appearance setting later, it overrides the system.
4. Screen background component (used by every screen except Feed):
   ```tsx
   <LinearGradient colors={t.background.colors} locations={t.background.locations} style={StyleSheet.absoluteFill} />
   ```
   Light is a vertical gradient `#DDE7F3 → #EEF3F9 (45%) → #F6F8FC`; dark is flat `#0D1729`.
5. Status bar: `dark-content` in light mode, `light-content` in dark mode and on Feed.

## 2. Global rules

- **Remove all old glows** (violet/blue/red/green radial blurs) and the frosted-glass card look. Cards are now **solid** (`surface.card`) with a 1pt `surface.cardBorder` and `shadow.card`.
- **Keep/delete colours only mean keep/delete.** Green: `keep.*`; red: `remove.*`. Toggles and selected states use `accent`, never green.
- **Feed is always dark**: pure black `#000` background with the `dark` theme tokens in both modes (immersive photo mode), including its tab bar.
- **No blue→violet gradients** anywhere (old Continue / Review buttons). All primary buttons are solid `accent.button` with white text.
- Text on photos stays white (`#FFFFFF`, secondary `rgba(255,255,255,0.9)`) over the existing bottom scrim `linear-gradient(transparent 35% → rgba(0,0,0,0.55))`.
- Chips on photos (Today, date, size, Best, counts) use `photoChip.bg` / `photoChip.text`.
- Minimum touch target 44pt (visual circles are 38pt; extend with `hitSlop`).

## 3. Components

| Component | Spec |
|---|---|
| **Card** | bg `surface.card`, border 1pt `surface.cardBorder`, radius 22 (`radius.card`), `shadow.card`. Padding 14. |
| **Small tile** (Home 2×2) | Card variant, height 53, radius 18, padding 0 10, gap 9. Left: **Icon well**. Title 14.5/700, subtitle 11/regular `text.secondary` (single line). |
| **Icon well** | 32×32, radius 10, bg `tile[c].bg`, outline icon 17pt stroke 2 `tile[c].fg`. Colour per item: Feed `blue`, Similar `teal`, By Year `amber`, By Location `sky`; Settings: Pro `amber`, Restore `blue`, Batch size `blue`, Face ID `teal`, Analytics `sky`, On This Day reminder `amber`, Help `rose`, Privacy `blue`; Screenshots tile `blue`; Feed post headers: month `blue`, place `sky`. |
| **Tab bar** | Floating pill: left/right inset 18, height 56, bottom 30 from the screen bottom (top at y=758 on an 844pt screen), radius 28, bg `tabBar.bg`, border `tabBar.border`, `shadow.floating`, padding 5, 4 equal items, gap 4. Item: radius 23, icon 20pt **outline** stroke 1.8, label 10.5/700. Active: bg `accent.tint`, icon+label `accent.onTint`. Inactive: transparent, `text.tertiary`. |
| **Primary button** | Height 52, radius 26, bg `accent.button`, label 17/700 white, optional 18pt sparkle icon left (gap 8). `shadow.floating` when floating over content. |
| **Start pill** (on photo cards) | Height 42, padding 0 18, radius 21, bg `accent.button`, 15/700 white. |
| **Circle button** (back / close / settings) | 38×38 (34 on Home header), radius 50%, bg `surface.card`, border `surface.cardBorder`, icon 16pt stroke 2.4 `text.primary`. |
| **Tint pill button** ("Review 2 ›") | Height 32, padding 0 12, radius 16, bg `accent.tint`, 14/700 `accent.onTint`, chevron 12pt. |
| **Segmented control** | Track height 41, radius 13, padding 3, bg `surface.raised`. Active segment radius 10, bg `surface.segmentActive`, 14.5/700 `surface.segmentActiveText`, shadow `0 1 3 rgba(0,0,0,0.10)`. Inactive 14.5/700 `text.secondary`. Settings batch-size variant: active uses `accent.tint` / `accent.onTint`; Pro options show a 11pt `star` in `star`. |
| **Toggle** | 51×31, on = `toggleOn` (accent), off = `toggleOff`, white knob 27pt. |
| **Progress ring** (rows) | 32pt, 3pt stroke. 0%: `track` + 8.5/700 `text.secondary`. In progress: `accent.primary`. Done: `keep.ring` stroke, `keep.tint` fill, check in `keep.icon`. On This Day header ring: 54pt, 5pt stroke. |
| **Progress bar** | Height 4 (3 on review screens), radius 2, track `track`, fill `accent.primary`. Free-plan meter: two equal segments, `accent.primary` + `accent.soft`. |
| **Swipe action circles** | 62pt, 2pt ring. Delete: ring `remove.ring`, bg `remove.tint`, outline trash icon `remove.icon`. Keep: ring `keep.ring`, bg `keep.tint`, outline heart `keep.icon`. Hint "Swipe or tap" 12/700 `text.secondary`, centred between them. |
| **Two-line action button** (group review) | Height 64, radius 32, bg `surface.card`, 2pt ring (`keep.ring` / `remove.ring`), 22pt icon, title Nunito 17/800, subtitle 11 `text.secondary`, single line. |
| **Photo chip** | Height 22–26, radius 11–13, bg `photoChip.bg`, text `photoChip.text` 11.5–13/700. "Best"/"Keep" chips start with a 12–13pt filled `star` in `star`. |
| **Streak pill** | Height 32, radius 16, bg `streak.bg`, border `surface.cardBorder`, flame icon (fill `streak.flame`, stroke `streak.text`) + count 14/700 `streak.text`. |
| **Trash badge** (Feed header) | 18pt pill on the trash icon, bg `remove.fill`, 11/800 white. |
| **Week dots** | 20pt circles: done = `#F29A0E` with white ✓, today = 2pt ring in `text.primary`, others `dotOff`. Day letters 9.5/600 `text.secondary` (today `text.primary`). |

## 4. Screens (map to canvas artboards)

Coordinates are in points on a 390×844 canvas. The status bar is not drawn; content starts at y≈66.

1. **Home** (`LP-Home` / `DP-Home`). Header: "Swipe Photos" Nunito 31 + streak pill + settings circle. Free-plan card: card with `accent.tint` border, bolt in a 38pt `accent.tint` well, FREE chip `accent.tint`/`accent.onTint`, link "Go unlimited" `accent.link`. Stats card: "6% reviewed" Nunito 22, progress bar, Photos/Videos/Freed (freed value in `keep.text`), divider, week dots. On This Day photo card (149pt) and Random 25 photo card (106pt) with Start pills. 2×2 small tiles. Tab bar (Home active).
2. **Feed** (`LP-Feed` / `DP-Feed`). Always dark on `#000`. Header "Swipe Photos" Nunito 27 + trash icon with red count badge. Stories: 64pt circles with a 2.5pt ring: new = `accent.primary` (dark), partly reviewed = `track` ring + "14 left" chip (`accent.tint`/`accent.onTint`). **Do not use the old orange/pink gradient ring.** Post header: 34pt icon well (calendar `blue` / pin `sky`) + title 16/700 (+ subtitle) + "···". Full-bleed photo. Actions: "Keep" heart (`keep.icon`), "Delete" trash (`remove.icon`), bookmark (white) on the right. Tab bar dark (Feed active).
3. **Similar** (`LP-Similar` / `DP-Similar`). Large title "Similar" + summary line. 2-column grid of group photos (170pt high, radius 20, `shadow.card`) with "Best" chip; caption row: count 15/700 + size 13 `text.secondary`. Bottom fade into the background, then the "Grouped by when photos were taken" chip (card style, 12/600) and the primary button "Review 25 groups" with sparkle icon (replaces the old green→cyan gradient). Tab bar (Similar active).
4. **Library · Months** (`LP-Months` / `DP-Months`). Large title + "45 months · 521 items", segmented control (Months active), section label "2026", month rows (81pt cards: 60pt thumb radius 12, name 15.5/700, count 13.5 `text.secondary`, progress ring).
5. **Library · Types** (`LP-Types` / `DP-Types`). Segmented (Types active). 2×2 tiles 118pt high: Random 25, Videos, On This Day as photo tiles with a count chip; Screenshots as a plain card with a `blue` icon well and a count chip on `surface.raised`. "Places" Nunito 21 + "On your iPhone" right, then place rows (same as month rows).
6. **On This Day** (`LP-OnThisDay` / `DP-OnThisDay`). Back circle, large title, "November 5 · 1 year of memories". Summary card (84pt) with a 54pt ring + "0 of 2 reviewed" Nunito 18 + subtitle. Year row "2025" Nunito 22 + "2 photos", tint pill "Review 2 ›". Progress bar. Thumbnails 100×125 radius 14. Bottom primary button "Review 2 photos" at y=700.
7. **Settings** (`LP-Settings` / `DP-Settings`). Back circle, large title. Section labels 12/700 +0.12em `text.secondary`. Grouped cards (radius 20) with rows ≥54pt: icon well, label 16/500, optional subtitle 12.5 `text.secondary`, chevron `text.tertiary` or toggle. Rows separated by 1pt `surface.divider`. Batch-size segmented control inside the Review card.
8. **Swipe review** (`LP-Swipe` / `DP-Swipe`). Close circle, centred title "Random Review" Nunito 17 + "25 of 25 left" 12. Progress bar y=119. Photo card 334×558 at (28,143), radius 26, shadow `0 18 40 rgba(18,35,61,0.22)` (keep the same in dark). Date/size chips bottom-left. Action circles at y=730.
9. **Similar group review** (`LP-Group` / `DP-Group`). Close circle, title "Similar Photos" + "25 of 25 groups left", "★ Multi" pill (card style) on the right. Photo 334×444 radius 26 with a "★ Keep" chip and bottom chips "2 similar", "trash 1 · 938 KB". Thumbnails 74pt radius 16: starred = 3pt `star` border + star badge; to-delete = 3pt `remove.ring` border, 75% opacity, trash badge (`remove.fill`). Buttons "Keep All / Nothing gets deleted" and "Delete 1 / Keeps 1 starred".
10. **Trash** (`LP-Trash` / `DP-Trash`). Modal sheet on `sheetBehind`, top radius 30, background gradient. Header: back circle, "Trash" Nunito 22, helper text, "Deselect all" `accent.link`. 3-column grid (110pt, radius 13) with a 2.5pt `remove.ring` border + red check badge (`remove.fill`). Floating bottom bar: card style + `shadow.floating`, "27 selected" + size line, Delete button `remove.fill` with trash icon.
11. **Paywall** (`LP-Paywall` / `DP-Paywall`). Close circle, hero photo 104×130 radius 14 with a 3pt card-coloured border. Title Nunito 29 (2 lines). Plan cards (card style): Yearly with the `badge` "BEST VALUE · SAVE 88%"; selected plan Weekly with a 2pt `accent.primary` border and filled check. Feature card with `accent.tint` icon circles (infinity, stack). Continue primary button at y=632, legal text 11 `text.secondary`, links 12 `text.primary` underlined. Keep all App Store copy unchanged.

Session complete, onboarding and empty states are not drawn: apply the same tokens (background, card, primary button). For confetti/success, use `keep.*` for the "kept" figure and `accent` for everything else.

## 5. Accessibility / contrast (verified)

- Light: `text.primary` on background 12.6:1; `text.secondary` on background 5.3:1 and on white 6.6:1; `text.tertiary` on white 5.4:1; `accent.onTint` on `accent.tint` 6.9:1; white on `accent.button` 6.2:1; `keep.text` on white 5.0:1.
- Dark: `text.primary` on `#0D1729` 16.1:1; `text.secondary` on card 6.8:1; `text.tertiary` on tab bar 5.6:1; white on `accent.button` (#3B6FE0) 4.6:1; `accent.onTint` on tint 6.9:1; `keep.text` on card 8.9:1.
- Both: white on `remove.fill` (#CF3A30) 4.9:1.
- Keep and delete are told apart by icon (heart / trash), label and position, not by colour alone.

## 6. Suggested implementation order for Claude Code

1. Add `theme.ts`, `icons.tsx`, fonts and a `ThemeProvider` + `useTheme()` hook.
2. Build shared primitives: `ScreenBackground`, `Card`, `IconWell`, `TabBar`, `PrimaryButton`, `StartPill`, `CircleButton`, `Segmented`, `Toggle`, `ProgressRing`, `ProgressBar`, `PhotoChip`, `SwipeActionButton`.
3. Remove the glow/blur background layers and the frosted cards from every screen; swap in `ScreenBackground` + `Card`.
4. Restyle screens in this order: Home → Library (Months/Types) → Similar → Swipe review → Similar group review → Trash → Paywall → On This Day → Settings → Feed.
5. Check every screen in both appearances against the canvas rows, with Dynamic Type at the default size and one size larger.
