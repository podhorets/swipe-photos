#!/usr/bin/env node
// Theme audit (CLAUDE.md › Theme): fails when screens bypass the design
// tokens. Run with `npm run audit:theme`; part of the quality gates.
//
// Colour values may only live in constants/colors.ts (and Icon.tsx draws
// with the colour it is given). Everything else uses token classes or
// useTheme().
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['app', 'components', 'lib', 'hooks', 'stores'];
const ALLOWED = new Set(['constants/colors.ts']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// Comments may mention colours ("no black flash"); only code counts
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, p) => p + ' '.repeat(m.length - p.length));
}

const tailwind = readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8');
const tokenList = tailwind.match(/const THEME_TOKENS = \[([\s\S]*?)\];/)?.[1] ?? '';
const twTokens = [...tokenList.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
const colors = readFileSync(join(ROOT, 'constants/colors.ts'), 'utf8');
const tsTokens = [...colors.matchAll(/^\s+'?([a-z0-9-]+)'?: \(t: Theme\) =>/gm)].map((m) => m[1]);

const problems = [];
const missingInTs = twTokens.filter((t) => !tsTokens.includes(t));
const missingInTw = tsTokens.filter((t) => !twTokens.includes(t));
if (missingInTs.length) problems.push(`tailwind.config.js: tokens without a value in constants/colors.ts TOKENS: ${missingInTs.join(', ')}`);
if (missingInTw.length) problems.push(`constants/colors.ts: TOKENS missing from tailwind THEME_TOKENS: ${missingInTw.join(', ')}`);

const tokenAlt = twTokens.map((t) => t.replace(/-/g, '\\-')).join('|');
const RULES = [
  { re: /\b(?:text|bg|border(?:-[trbl])?)-(?:white|black)\b/, msg: 'white/black class — use a theme token (on photos: text-on-photo / bg-chip)' },
  { re: /#[0-9A-Fa-f]{3,8}\b/, msg: 'hex colour — add a token to constants/colors.ts' },
  { re: /\brgba?\(/, msg: 'rgb()/rgba() colour — add a token to constants/colors.ts' },
  { re: /(?:^|[\s"'`])dark:[a-z]/, msg: 'dark: variant — it ignores ThemeScope; use tokens' },
  { re: new RegExp(`\\b(?:text|bg|border)-(?:${tokenAlt})\\/`), msg: 'alpha modifier on a theme token — tokens hold full colours' },
  { re: /font-display(?:-bold)?\b[^"'`]*\bfont-(?:medium|semibold|bold|extrabold|black)\b|\bfont-(?:medium|semibold|bold|extrabold|black)\b[^"'`]*font-display\b/, msg: 'font-display with a weight class — iOS falls back to the system font' },
  { re: /from ['"](?:@expo\/vector-icons[^'"]*|expo-blur)['"]/, msg: 'Ionicons / expo-blur import — use <Icon> and Card' },
];
// A Text needs its own colour class (RN Text defaults to black)
const TEXT_COLOR = /\btext-(?:fg|fg-2|fg-3|on-[a-z-]+|link|accent|keep-[a-z]+|del-[a-z]+|streak-fg|chip-fg|segment-fg|badge-fg|tile-[a-z]+-fg|star)\b/;

for (const file of DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file);
  if (ALLOWED.has(rel)) continue;
  const code = stripComments(readFileSync(file, 'utf8'));
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    for (const { re, msg } of RULES) {
      if (re.test(line)) problems.push(`${rel}:${i + 1}  ${msg}\n    ${line.trim()}`);
    }
  });
  // Opening <Text …> tags, ending at the first `>` outside {…} (so
  // `a > b` and `=>` inside attribute expressions don't end the tag)
  for (const m of code.matchAll(/<Text\b/g)) {
    let depth = 0;
    let end = m.index + 5;
    for (; end < code.length; end++) {
      const ch = code[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    const tag = code.slice(m.index, end);
    if (!TEXT_COLOR.test(tag)) {
      const line = code.slice(0, m.index).split('\n').length;
      problems.push(`${rel}:${line}  <Text> without a colour class (defaults to black)`);
    }
  }
}

if (problems.length) {
  console.error(`theme-audit: ${problems.length} problem(s)\n`);
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`theme-audit: OK (${twTokens.length} tokens, ${DIRS.join(', ')})`);
