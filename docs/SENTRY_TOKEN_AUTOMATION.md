# Sentry Auth Token Automation — Implementation Plan

Goal: **no manual step, ever** — Xcode GUI archives, `expo run:ios`, and CI/EAS builds
all get Sentry credentials automatically, surviving `expo prebuild --clean`.

## ✅ Implementation status

**Done (committed):**
- `plugins/withSentryAuthToken.js` — the config plugin (section 2.1).
- Registered in `app.json` after `@sentry/react-native/expo` (section 2.2).
- `eslint.config.js` — `plugins/**` added to ignores (build-time CJS, matching
  metro/babel/tailwind configs).
- Verified: isolated unit test of the mod passes (merge / idempotence / rotation /
  graceful no-token), and `npx expo config` resolves the plugin chain with exit 0.
  The current `ios/sentry.properties` already carries the token, so Xcode archives
  keep working today; the plugin guarantees it survives future prebuilds.

**Still to do by you (external — can't be automated from here):**
- Run the real destructive verification when convenient: `rm -rf ios &&
  npx expo prebuild --platform ios` then `grep -c '^auth.token=' ios/sentry.properties`
  → expect `1` (section 5, steps 1–5). Re-`pod install` after, since prebuild
  regenerates the project.
- CI: `eas env:create --name SENTRY_AUTH_TOKEN --value sntrys_… --scope project
  --environment production --visibility secret` (repeat per environment) — section 3.1.
- GitHub Actions (if used): add `SENTRY_AUTH_TOKEN` as a repository secret — section 3.2.

---

## 1. The problem, precisely

Two Xcode build phases call `sentry-cli` and need an auth token:

1. **"Bundle React Native code and images"** — wrapped by
   `@sentry/react-native/scripts/sentry-xcode.sh` → uploads JS source maps.
2. **"Upload Debug Symbols to Sentry"** — `sentry-xcode-debug-files.sh` → uploads dSYMs.

`sentry-cli` resolves credentials in this order:

1. `SENTRY_AUTH_TOKEN` environment variable **of the sentry-cli process**
2. `auth.token` in the file pointed to by `SENTRY_PROPERTIES`
   (the build phase sets `SENTRY_PROPERTIES=sentry.properties` → `ios/sentry.properties`)
3. `~/.sentryclirc` (machine-global)

Our token lives in `.env.local` (`SENTRY_AUTH_TOKEN=sntrys_…`). The catch:
**who loads `.env.local` depends on how the build is launched**, which is why this
keeps breaking in different ways per context:

| Build context | Does sentry-cli see the token? | Why |
|---|---|---|
| `pnpm run ios` / `expo run:ios` (CLI) | ✅ yes | Expo CLI loads `.env.local` into its own env, spawns `xcodebuild` → build phases inherit env |
| **Xcode.app GUI** (Archive from menu) | ❌ **no** | Xcode launched from Dock/Finder inherits no shell env and never reads `.env.local` |
| CI (EAS build / GitHub Actions) | ✅ yes, *if* the secret is set as a job-level env var | build phases inherit the runner env |
| Fresh `expo prebuild --clean` + Xcode GUI | ❌ no | regenerates `ios/sentry.properties` **without** `auth.token` (the Sentry Expo plugin writes only `defaults.url/org/project`) |

So the only genuinely broken path is **Xcode GUI**, and the current manual fix
(hand-editing `ios/sentry.properties`) evaporates on every `prebuild --clean`.

`ios/sentry.properties` is generated at prebuild by the `@sentry/react-native/expo`
config plugin (configured in `app.json` with `url`, `project: swipe-photos`,
`organization: cleaner-p7`). `/ios` is gitignored (CNG project), so nothing in that
directory is a durable place for manual edits — the fix must happen **during prebuild**.

## 2. Solution: a local Expo config plugin writing `ios/.xcode.env.local`

A local plugin (`plugins/withSentryAuthToken.js`) runs at prebuild and writes
`export SENTRY_AUTH_TOKEN=…` into **`ios/.xcode.env.local`**. Every RN build script
phase sources that file, so sentry-cli finds the token regardless of how Xcode is
launched (GUI archive included). Survives `expo prebuild --clean`. Zero recurring
manual steps.

> ⚠️ **Two wrong turns, both fixed — read before touching this:**
>
> 1. **Env-only token read was a no-op.** The first version read
>    `process.env.SENTRY_AUTH_TOKEN` only, assuming `expo prebuild` preloads `.env.local`.
>    Prebuild logs showed it didn't populate it in time. The plugin now reads
>    `.env.local`/`.env` at the project root directly (after checking `process.env` for
>    CI/EAS).
> 2. **`sentry.properties` gets clobbered.** The second version wrote `auth.token` into
>    `ios/sentry.properties`. Prebuild logs proved the write happened
>    (`auth.token written`) but the final file had **zero** token lines: the
>    `@sentry/react-native/expo` plugin runs its own mod **after** ours and regenerates
>    `sentry.properties` token-less. Array ordering did not fix it. **Solution: target
>    `ios/.xcode.env.local` instead** — the Sentry plugin never touches it, and
>    `pod install` preserves an existing one (both verified). This is also exactly how
>    the sibling `cleaner-final` app supplies the token.
>
> The plugin also writes `export NODE_BINARY=<absolute node path>` into the same file,
> because `.xcode.env` uses `$(command -v node)` which fails in Xcode GUI archives where
> nvm's node isn't on PATH — the `.local` override is what lets GUI archives find node.
>
> The old env-only code block below is **historical** — the shipped file is the
> `.xcode.env.local` version.

### 2.1 Plugin file: `plugins/withSentryAuthToken.js`

```js
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Merges SENTRY_AUTH_TOKEN from the environment into ios/sentry.properties at
 * prebuild time. Expo CLI loads .env/.env.local before running config plugins,
 * so locally the token comes from .env.local; on CI it comes from the runner's
 * secret env. Without this, Xcode GUI archives fail the source-map upload
 * ("Auth token is required") because Xcode never sees shell env or .env files.
 *
 * Order-independent by design: works whether it runs before or after the
 * @sentry/react-native/expo plugin that creates the file.
 */
const withSentryAuthToken = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const token = process.env.SENTRY_AUTH_TOKEN;
      const propsPath = path.join(cfg.modRequest.platformProjectRoot, 'sentry.properties');

      if (!token) {
        // Never fail prebuild: CLI/CI builds still work via inherited env.
        console.warn(
          '[withSentryAuthToken] SENTRY_AUTH_TOKEN not set — ios/sentry.properties ' +
            'will have no auth.token. Xcode GUI archives will fail the Sentry upload. ' +
            'Add SENTRY_AUTH_TOKEN to .env.local (local) or CI secrets.',
        );
        return cfg;
      }

      // Merge, never clobber: keep whatever the Sentry plugin wrote (or will
      // write) and only manage the auth.token line.
      let existing = '';
      if (fs.existsSync(propsPath)) {
        existing = fs.readFileSync(propsPath, 'utf8');
      }
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
```

Implementation notes:

- **`withDangerousMod` on `ios`** is the right hook: it runs during prebuild after the
  template is generated, with `platformProjectRoot` pointing at `ios/`.
- **Order independence**: config-plugin mod execution order relative to the Sentry
  plugin is an implementation detail we must NOT depend on. The merge logic handles
  both cases: if the Sentry plugin already wrote the file we append to it; if we run
  first and create it, the Sentry plugin's own writer preserves/merges (verify in
  step 5 — if it turns out to clobber, register our plugin **after** it in the array,
  which makes our mod run in the correct order for the current @sentry/react-native
  implementation).
- **Never throw on missing token** — a contributor without the secret must still be
  able to prebuild and run Debug builds (the Sentry script already skips uploads for
  Debug configurations).

### 2.2 Registration: `app.json`

Add to the `plugins` array, **after** the `@sentry/react-native/expo` entry:

```json
"plugins": [
  ...,
  ["@sentry/react-native/expo", { "url": "https://sentry.io/", "project": "swipe-photos", "organization": "cleaner-p7" }],
  "./plugins/withSentryAuthToken"
]
```

No package.json changes needed — relative-path plugins are resolved directly.

### 2.3 Local developer flow after this change

```
# one-time per machine (already done):
#   .env.local contains SENTRY_AUTH_TOKEN=sntrys_...

npx expo prebuild --clean   # plugin injects auth.token automatically
open ios/SwipePhotos.xcworkspace  # Archive works, uploads work
```

Nothing else. The token line survives every prebuild because the plugin re-creates it.

## 3. CI/CD setup (the part that always bites)

### 3.1 EAS Build (the project has eas.json with development/preview/production)

Two independent mechanisms — use **both** for belt and suspenders:

1. **Secret env var** (primary): `eas env:create --name SENTRY_AUTH_TOKEN --value sntrys_… --scope project --environment production --visibility secret`
   (repeat for `preview`/`development` environments as needed).
   EAS injects it into the build job env → **two** things then work:
   - Expo CLI's prebuild on the EAS worker sees it → the plugin writes it into
     sentry.properties.
   - Even if the plugin were removed, `xcodebuild` build phases inherit the job env,
     so sentry-cli would find `SENTRY_AUTH_TOKEN` directly.
2. Do **NOT** put the token in `eas.json` `env` blocks — that file is committed;
   plaintext secrets in git are how tokens leak.

Gotchas seen in the wild (why CI "worked yesterday"):

- EAS caches `ios/` only when it is committed; with CNG (`/ios` gitignored) every EAS
  build runs prebuild fresh — good for us, the plugin always runs.
- If you ever commit `ios/` (bare workflow migration), the plugin stops running on CI
  (no prebuild) — you'd then rely purely on mechanism 1's env inheritance, which still
  works. Keep both paths healthy and this migration is a non-event.
- `--non-interactive` EAS builds fail on *interactive* sentry-cli login prompts;
  a present token avoids the prompt path entirely.

### 3.2 GitHub Actions (if/when a workflow builds iOS directly)

```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
steps:
  - run: pnpm install --frozen-lockfile
  - run: npx expo prebuild --platform ios   # plugin writes auth.token
  - run: cd ios && pod install
  - run: xcodebuild ... archive             # inherits env anyway (second safety net)
```

Store the token as a **repository secret**, never in the workflow file.

### 3.3 Sentry-side hygiene

- Use an **organization auth token** (`sntrys_…`) scoped to `project:releases` +
  `project:read` only — source-map/dSYM upload needs nothing broader.
- Rotate: create the new token → update `.env.local` + EAS env + GH secret → delete
  the old one. The plugin makes rotation a pure secret-store operation (no code).

## 4. Alternatives considered and rejected

| Alternative | Why not |
|---|---|
| Commit `ios/sentry.properties` with the token | Secret in git. Immediate disqualification. |
| `postinstall` script writing the file | Wrong lifecycle: runs at dependency install, when `ios/` may not exist yet; silently skipped by some CI installs (`--ignore-scripts`); doesn't re-run after `prebuild --clean`. |
| Patch the Xcode build phase (via `withXcodeProject`) to `source ../.env.local` | Works, but mutates the pbxproj script blob — brittle across @sentry/react-native upgrades (they rewrite the phase), harder to review, and parses `.env.local` with shell quoting hazards. The properties file is the documented sentry-cli mechanism. |
| `~/.sentryclirc` on the dev machine | Fixes one machine forever, but is manual per machine, invisible to the repo, and does nothing for CI. Acceptable as a personal stopgap, not a solution. |
| `SENTRY_DISABLE_AUTO_UPLOAD=true` / `SENTRY_ALLOW_FAILURE=true` | Silences the failure by giving up source maps / letting uploads rot. Defeats the purpose of having Sentry. |

## 5. Verification checklist (do these in order)

1. `rm -rf ios && npx expo prebuild --platform ios` →
   `grep -c '^auth.token=' ios/sentry.properties` prints `1`; org/project lines intact.
   (Confirms merge + ordering with the Sentry plugin. If the file only contains
   `auth.token`, the Sentry plugin clobber/ordering assumption failed — move our
   plugin entry after/before accordingly and re-test.)
2. Run prebuild **twice** → still exactly one `auth.token` line (idempotence).
3. `unset SENTRY_AUTH_TOKEN` + temporarily comment it out of `.env.local` → prebuild
   succeeds with the warning, no token line (graceful degradation).
4. `cd ios && LANG=en_US.UTF-8 pod install`, then **Xcode GUI → Product → Archive** →
   succeeds; build log shows `output: sentry-cli` upload lines, not `error:`.
5. `npx expo run:ios --configuration Release` → still builds (env-inheritance path).
6. EAS: `eas build --profile preview --platform ios` after setting the EAS env secret →
   build log's bundle phase shows successful upload; check Sentry → Releases →
   source maps attached.
7. Negative CI test: run one EAS build with the secret deliberately absent →
   expect the "Auth token is required" failure → confirms the secret is actually
   what's carrying the build (no hidden fallback), then restore it.

## 6. Failure modes & how they present

| Symptom | Cause | Fix |
|---|---|---|
| Xcode GUI archive: `Auth token is required` | prebuild ran without env token (warning was printed) | put token in `.env.local`, re-run prebuild |
| EAS build same error | EAS env secret missing/wrong environment (`production` vs `preview`) | `eas env:list` per environment, create where missing |
| Token works locally, 401 on CI | different/rotated token in CI secret store | rotate consistently everywhere (step 3.3) |
| `sentry.properties` has two auth.token lines | plugin merge regressed | the filter in the plugin strips ALL `auth.token=` lines before appending — re-check plugin code |
| Uploads suddenly slow/fail after RN/Sentry upgrade | @sentry/react-native rewrote build phases | re-run verification checklist; the plugin itself is upgrade-proof (touches only the properties file) |

## 7. Out of scope (deliberately)

- `sentry.options.json` (runtime SDK options file): the build log's "not found —
  skipping" message is benign; runtime config lives in `Sentry.init` in
  `app/_layout.tsx`. No file needed.
- Android: same pattern applies (`android/sentry.properties` + a `withDangerousMod`
  on `'android'` in the same plugin) — add the ~6 lines when Android becomes a target.
