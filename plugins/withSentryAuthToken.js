const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Injects the Sentry auth token into ios/sentry.properties at prebuild time so
 * Xcode GUI archives don't fail the source-map upload with "Auth token is
 * required", and so the fix survives `expo prebuild --clean` (the
 * @sentry/react-native plugin regenerates the file with only
 * defaults.url/org/project — no token).
 *
 * Token resolution (first hit wins):
 *   1. process.env.SENTRY_AUTH_TOKEN  — CI/EAS secrets, and any shell that
 *      exported it. Do NOT rely on Expo pre-loading .env here: `expo prebuild`
 *      does not reliably populate process.env from .env.local, which is why an
 *      earlier env-only version silently no-op'd and left the file token-less.
 *   2. .env.local / .env at the project root — the local-dev path. These are
 *      gitignored, so they never exist on CI, where step 1 covers it instead.
 *
 * The merge is idempotent: existing auth.token lines are stripped before the
 * current one is appended, so repeat prebuilds never accumulate duplicates.
 */

// Minimal KEY=VALUE reader for a single env var — avoids depending on dotenv
// being hoisted (pnpm) and only needs one key.
function readTokenFromEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return undefined;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== 'SENTRY_AUTH_TOKEN') continue;
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present
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
      const propsPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'sentry.properties',
      );

      if (!token) {
        // Never fail prebuild: Debug builds skip the upload, and a contributor
        // without the token can still work. Only Xcode GUI archives break.
        console.warn(
          '[withSentryAuthToken] No SENTRY_AUTH_TOKEN in env, .env.local, or .env — ' +
            'ios/sentry.properties will have no auth.token and Xcode archives will fail ' +
            'the Sentry upload.',
        );
        return cfg;
      }

      const existing = fs.existsSync(propsPath)
        ? fs.readFileSync(propsPath, 'utf8')
        : '';

      const withoutToken = existing
        .split('\n')
        .filter((line) => !line.startsWith('auth.token='))
        .join('\n')
        .replace(/\n+$/, '');

      fs.writeFileSync(propsPath, `${withoutToken}\nauth.token=${token}\n`);
      console.log('[withSentryAuthToken] auth.token written to ios/sentry.properties');
      return cfg;
    },
  ]);
};

module.exports = withSentryAuthToken;
