# Zyph

Offline-first travel super-app (React Native + Expo).

## Stack

Expo SDK 56 - React Native 0.85 (New Architecture) - React 19.2 (React Compiler) - TypeScript 6 strict - Expo Router - Unistyles 3 - TanStack Query 5 - MMKV - Supabase (Postgres, Auth, Storage, Edge Functions) - expo-maps - EAS - Turborepo + pnpm

## Requirements

- Node `24.11.0` (see `.nvmrc`)
- pnpm `10.30.3`
- macOS or Linux
- Xcode 16+ (iOS development)
- Android Studio (Android development)

## Getting started

```sh
nvm use
pnpm install
pnpm mobile start
```

Other common commands: `pnpm mobile ios` / `pnpm mobile android` to run on a simulator or device,
and `pnpm lint`, `pnpm typecheck`, `pnpm test` from the repo root.

## Documentation

Documentation, ADRs, runbooks: Outline (private) - URL TBD.

Sprint backlog: GitHub Projects (private) - URL TBD.

## License

[MIT](./LICENSE)
