# mobile

The ZYPH Expo app - the only workspace in this monorepo.

Run everything from the repo root: see the [root README](../../README.md) for setup, and
`CLAUDE.md` for the architecture and conventions.

```sh
pnpm mobile start          # expo start
pnpm mobile ios            # run on the iOS simulator / device
pnpm mobile android        # run on the Android emulator / device
pnpm test                  # jest, from the repo root
```

Routes live in `src/app` (Expo Router, file-based) - **not** in `app/`.
