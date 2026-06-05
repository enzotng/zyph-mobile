# E2E tests (Maestro) - TECH-008 / #12

End-to-end flows covering the core demo path: onboarding -> sign-in -> create a trip -> add an expense.

## Why these run on a device, not a simulator

The iOS Simulator is **not usable** on Apple Silicon for this app: ML Kit (receipt OCR) ships no `arm64-simulator` slice. So Maestro runs against a **real connected device** running a dev/release build of ZYPH (`fr.enzotang.zyph`). Maestro auto-detects the connected device.

## One-time setup

```bash
# Install the Maestro CLI (standalone, not an npm dependency)
curl -Ls "https://get.maestro.mobile.dev" | bash
maestro --version
```

Build and install ZYPH on the device first (`npx expo run:ios --device`), then make sure it launches.

## Running

From `apps/mobile`:

```bash
# whole suite, in order (00 -> 03)
pnpm e2e

# a single flow
maestro test .maestro/flows/01-sign-in.yaml
```

### Credentials (do not commit them)

`01-sign-in` needs a real test account. Pass it at runtime - never hard-code it:

```bash
maestro test --env EMAIL=you@test.app --env PASSWORD=secret .maestro
```

### Language

The flows target visible text, defaulting to **English** (the `env:` block at the top of each flow). For a **French** device, replace each `env` value with the FR string shown in the inline comment (e.g. `SIGN_IN: "Se connecter"`). Set the device language before running.

## Targeting strategy

- Text buttons / labels -> matched by their visible text (the `env` strings).
- Icon-only buttons (the header `+`, etc.) -> matched by their `accessibilityLabel`, which the components already set.
- Text inputs -> matched by their **placeholder** (visible while the field is empty).
- Navigation into the trips list uses the `zyph://` deep link to stay independent of the home screen's data state.

## Status

These flows are authored against the real screens and i18n strings but are **not yet validated on-device**. Expect to validate/tune selectors on the first successful device run - the most likely spots are the amount-field placeholder (`AMOUNT_PLACEHOLDER`) and the `zyph:///trips` deep link. Hardening idea: forward `testID` from the `Button`/`TextField` primitives and target by `id:` for locale-independent, placeholder-independent selectors.

### First-run findings (2026-06-05)

A first attempt on a physical iPhone (iOS 26.5) got everything in place except the device transport:

- **Apple team id is required** to build/sign the Maestro iOS driver for a physical device. Pass it via the `TEAM_ID` environment variable (it is not a `maestro test` flag):
  `TEAM_ID=<your-apple-team-id> maestro --device <udid> test .maestro` - this cleared the signing step.
- **iOS 17+ device transport was the blocker.** Maestro / go-ios could not establish a stable connection to the iOS 26.5 device (`not connected` with an explicit `--device`, `0 devices` on auto-detect), even though macOS reported it paired+available. Modern iOS needs the go-ios tunnel (typically run elevated) or **Maestro Cloud** to drive a real device. This is an environment/transport limitation, not a problem with the flows.
- A confirmed test account exists (`e2e-maestro@zyph.app`); pass its password via `--env PASSWORD=...` (never committed).

To finish validation later: run via Maestro Cloud, or start the go-ios tunnel for the device, then `TEAM_ID=... maestro --device <udid> test .maestro --env EMAIL=... --env PASSWORD=...`.
