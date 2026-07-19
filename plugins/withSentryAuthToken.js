const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Merges SENTRY_AUTH_TOKEN from the environment into ios/sentry.properties at
 * prebuild time. Expo CLI loads .env/.env.local before running config plugins,
 * so locally the token comes from .env.local; on CI it comes from the runner's
 * secret env. Without this, Xcode GUI archives fail the source-map upload
 * ("Auth token is required") because Xcode never sees shell env or .env files,
 * and every `expo prebuild --clean` regenerates sentry.properties without a
 * token (the @sentry/react-native plugin only writes defaults.url/org/project).
 *
 * Order-independent by design: the merge keeps whatever the Sentry plugin wrote
 * and only manages the auth.token line, so it works whether this mod runs before
 * or after that plugin's own file writer.
 */
const withSentryAuthToken = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const token = process.env.SENTRY_AUTH_TOKEN;
      const propsPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'sentry.properties',
      );

      if (!token) {
        // Never fail prebuild: CLI/CI builds still work via inherited env, and
        // Debug builds skip the upload entirely. Only Xcode GUI archives need
        // the file-based token.
        console.warn(
          '[withSentryAuthToken] SENTRY_AUTH_TOKEN not set — ios/sentry.properties ' +
            'will have no auth.token. Xcode GUI archives will fail the Sentry upload. ' +
            'Add SENTRY_AUTH_TOKEN to .env.local (local) or CI secrets.',
        );
        return cfg;
      }

      const existing = fs.existsSync(propsPath)
        ? fs.readFileSync(propsPath, 'utf8')
        : '';

      // Strip ALL existing auth.token lines (idempotent — no duplicates on
      // repeat prebuilds) and append the current one.
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
