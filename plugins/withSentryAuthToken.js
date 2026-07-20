const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Makes SENTRY_AUTH_TOKEN available to Xcode build script phases so the Sentry
 * source-map / dSYM uploads succeed — including Xcode GUI archives, which never
 * see shell env or .env files. Survives `expo prebuild --clean`.
 *
 * Why ios/.xcode.env.local (NOT ios/sentry.properties):
 *   Every React Native build script phase sources $SRCROOT/.xcode.env and
 *   .xcode.env.local, so an `export SENTRY_AUTH_TOKEN=...` there reaches
 *   sentry-cli regardless of how Xcode is launched. Writing sentry.properties
 *   instead does NOT work under CNG: the @sentry/react-native/expo plugin runs
 *   its own mod AFTER this one and regenerates sentry.properties token-less,
 *   clobbering the write (verified in the prebuild logs). The Sentry plugin
 *   never touches .xcode.env.local, and `pod install` preserves an existing one,
 *   so this write is durable.
 *
 * Also writes NODE_BINARY as an absolute path: `.xcode.env` uses
 * `$(command -v node)`, which fails in Xcode GUI archives where nvm's node
 * isn't on PATH — the .local override is what makes GUI archives find node.
 *
 * Token resolution (first hit wins):
 *   1. process.env.SENTRY_AUTH_TOKEN  — CI/EAS secrets, exported shells.
 *   2. .env.local / .env at the project root — local dev (gitignored, so absent
 *      on CI, where step 1 covers it). Read directly rather than trusting Expo
 *      to preload it into process.env for prebuild.
 */

function readTokenFromEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return undefined;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1 || line.slice(0, eq).trim() !== 'SENTRY_AUTH_TOKEN') continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value || undefined;
  }
  return undefined;
}

function resolveToken(projectRoot) {
  if (process.env.SENTRY_AUTH_TOKEN) return process.env.SENTRY_AUTH_TOKEN;
  return (
    readTokenFromEnvFile(path.join(projectRoot, '.env.local')) ||
    readTokenFromEnvFile(path.join(projectRoot, '.env'))
  );
}

const withSentryAuthToken = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const token = resolveToken(cfg.modRequest.projectRoot);
      const envPath = path.join(
        cfg.modRequest.platformProjectRoot,
        '.xcode.env.local',
      );

      if (!token) {
        console.warn(
          '[withSentryAuthToken] No SENTRY_AUTH_TOKEN in env, .env.local, or .env — ' +
            'Xcode archives will fail the Sentry upload.',
        );
        return cfg;
      }

      // Preserve any existing lines (e.g. a NODE_BINARY pod-install wrote),
      // drop our own managed lines, re-append them — idempotent.
      const existing = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, 'utf8').split('\n')
        : [];
      const kept = existing.filter(
        (line) =>
          line.trim() &&
          !line.startsWith('export SENTRY_AUTH_TOKEN=') &&
          !line.startsWith('export NODE_BINARY='),
      );

      // Absolute node path: this is the node running prebuild — the one Xcode
      // GUI archives need since `$(command -v node)` fails without nvm on PATH.
      kept.push(`export NODE_BINARY=${process.execPath}`);
      kept.push(`export SENTRY_AUTH_TOKEN=${token}`);
      fs.writeFileSync(envPath, kept.join('\n') + '\n');
      console.log('[withSentryAuthToken] SENTRY_AUTH_TOKEN written to ios/.xcode.env.local');
      return cfg;
    },
  ]);
};

module.exports = withSentryAuthToken;
