import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The app's outline icon set (design handoff `icons.tsx`, plus the icons the
 * handoff didn't draw, in the same style): 24×24 grid, stroke 2 (tab bar 1.8),
 * round caps and joins.
 *
 *   <Icon name="home" size={20} color={t.accent.onTint} strokeWidth={1.8} />
 *
 * Filled glyphs: pass `fill` (star, heart, bookmark, flame); `play` is always
 * filled with `color`.
 */

// A toothed cog: 8 teeth on a ring (the handoff's gear read as a sun)
function cogPath() {
  const cx = 12;
  const cy = 12;
  const R = 9.6; // tooth tip
  const r = 7.3; // between teeth
  const pt = (radius: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + radius * Math.cos(a)).toFixed(2)} ${(cy + radius * Math.sin(a)).toFixed(2)}`;
  };
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = i * 45;
    d += `${i === 0 ? 'M' : 'L'}${pt(r, a - 13)} L${pt(R, a - 8)} L${pt(R, a + 8)} L${pt(r, a + 13)} `;
    d += `A${r} ${r} 0 0 1 ${pt(r, a + 45 - 13)} `;
  }
  return `${d}Z`;
}

interface IconDef {
  d: string;
  /** Extra stroked circles (cx, cy, r) */
  rings?: [number, number, number][];
  /** Extra filled dots (cx, cy, r) */
  dots?: [number, number, number][];
  /** Extra path filled with the icon colour */
  solid?: string;
  /** The main path is filled with the icon colour */
  filled?: boolean;
}

const ICONS = {
  // Tab bar
  home: { d: 'M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z' },
  feed: { d: 'M5 9.5h14V20H5zM7 6.5h10M9 3.5h6' },
  similar: { d: 'M9 8h11v12H9zM5 4.5h10M5 4.5V16' },
  library: { d: 'M3 6.5h6.5l2 2H21V19H3z' },
  // Tiles / rows
  stack: { d: 'M5 9h14v10H5zM7 6h10M9 3h6' },
  similarTile: { d: 'M10 8h10v12H8V10a2 2 0 0 1 2-2zM16 5H6a2 2 0 0 0-2 2v9' },
  calendar: { d: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4' },
  pin: { d: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  phone: { d: 'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2' },
  video: { d: 'M5 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM16 10l5-3v10l-5-3' },
  shuffle: { d: 'M4 7h3c5 0 5 10 10 10h3M17 14l3 3-3 3M17 4l3 3-3 3M20 7h-3c-1.5 0-2.5.8-3.3 2' },
  sparkle: { d: 'M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z' },
  bolt: { d: 'M13.5 2L5 13.5h6L10 22l9-12h-6z' },
  flame: { d: 'M12 21c-4 0-6.5-2.6-6.5-6 0-3.5 3-5.5 4-9 2 1.5 3 3 3 5 1-.5 1.8-1.5 2-3 1.8 1.6 4 4.2 4 7 0 3.4-2.5 6-6.5 6z' },
  infinity: { d: 'M7.5 9a3 3 0 1 0 0 6c2.5 0 6.5-6 9-6a3 3 0 1 1 0 6c-2.5 0-6.5-6-9-6z' },
  images: { d: 'M4 8h12v12H4zM8 4h12v12M4 16.5l3.5-3.5 3 3 2-2 3.5 3.5' },
  camera: { d: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4z', rings: [[12, 13.2, 3.3]] },
  // Actions
  trash: { d: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6' },
  trashSmall: { d: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13' },
  heart: { d: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z' },
  bookmark: { d: 'M7 4h10v16l-5-3.5L7 20z' },
  star: { d: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z' },
  check: { d: 'M5 12.5l4.5 4.5L19 7.5' },
  checkCircle: { d: 'M8 12.5l2.8 2.8L16.5 9.5', rings: [[12, 12, 9]] },
  close: { d: 'M6 6l12 12M18 6L6 18' },
  closeCircle: { d: 'M9 9l6 6M15 9l-6 6', rings: [[12, 12, 9]] },
  back: { d: 'M15 6l-6 6 6 6' },
  chevron: { d: 'M9 6l6 6-6 6' },
  undo: { d: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' },
  play: { d: 'M8 5.5v13l10.5-6.5z', filled: true },
  share: { d: 'M12 14.5V3.5M8 7.5l4-4 4 4M8.5 10.5H6v10h12v-10h-2.5' },
  add: { d: 'M12 5v14M5 12h14' },
  remove: { d: 'M5 12h14' },
  ellipsis: { d: '', dots: [[6, 12, 1.7], [12, 12, 1.7], [18, 12, 1.7]] },
  // Status
  warning: { d: 'M12 4L2.8 19.5h18.4zM12 10v4.5', dots: [[12, 17.2, 1.2]] },
  info: { d: 'M12 11v5.5', rings: [[12, 12, 9]], dots: [[12, 7.9, 1.2]] },
  cloudOffline: { d: 'M7.3 18.5H17a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.1a4.7 4.7 0 0 0 .2 9.4zM4 4l16 16' },
  hourglass: { d: 'M7 3.5h10M7 20.5h10M8 3.5V6c0 2.2 4 4 4 6s-4 3.8-4 6v2.5M16 3.5V6c0 2.2-4 4-4 6s4 3.8 4 6v2.5' },
  // Settings
  gear: { d: cogPath(), rings: [[12, 12, 3]] },
  restore: { d: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4' },
  lock: { d: 'M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3' },
  lockOpen: { d: 'M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2' },
  chart: { d: 'M5 20V12M10 20V5M15 20v-9M20 20v-6' },
  bell: { d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0' },
  help: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9' },
  shield: { d: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z' },
  document: { d: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7' },
  wrench: { d: 'M14.8 4a4.8 4.8 0 0 0-4.3 6.9L4.2 17.2a1.9 1.9 0 0 0 2.6 2.6l6.3-6.3A4.8 4.8 0 0 0 20 9.2l-2.9 2.9-3.2-1-1-3.2 2.9-2.9a4.8 4.8 0 0 0-1-1z' },
  contrast: { d: '', rings: [[12, 12, 9]], solid: 'M12 3a9 9 0 0 1 0 18z' },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Fill for fillable glyphs (star, heart, bookmark, flame). Defaults to none. */
  fill?: string;
}

export function Icon({ name, size = 20, color, strokeWidth = 2, fill }: Props) {
  const def: IconDef | undefined = ICONS[name];
  // A stale name (e.g. mid Fast Refresh) draws nothing instead of crashing the screen
  if (!def) return <Svg width={size} height={size} />;
  const pathFill = def.filled ? color : fill ?? 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {def.rings?.map(([cx, cy, r], i) => (
        <Circle key={`r${i}`} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} />
      ))}
      {def.solid && <Path d={def.solid} fill={color} />}
      {def.d !== '' && (
        <Path
          d={def.d}
          // A filled star keeps no outline (crisper at small sizes)
          stroke={name === 'star' && fill ? 'none' : color}
          fill={pathFill}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {def.dots?.map(([cx, cy, r], i) => (
        <Circle key={`d${i}`} cx={cx} cy={cy} r={r} fill={color} />
      ))}
    </Svg>
  );
}

/** Every icon name, for the developer icon sheet. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
