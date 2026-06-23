import { StyleSheet } from 'react-native-unistyles'

import { applyThemePreference, getThemePreference } from './lib/preferences'

// Spacing helper + radius/typography scales shared across themes.
// Radius scale aligned to platform norms (controls ~sm, inputs ~md, cards ~lg, sheets ~xl);
// shared primitives pair these with borderCurve 'continuous' for native iOS soft corners.
const shared = {
  gap: (v: number) => v * 4,
  radius: { sm: 12, md: 14, lg: 20, xl: 28, full: 9999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 34 },
  // Brand type: Space Grotesk for display/titles/numbers, Plus Jakarta Sans for body.
  // Names match the keys registered via useFonts in app/_layout.tsx (vendored .ttf).
  fonts: {
    display: {
      regular: 'SpaceGrotesk_400Regular',
      medium: 'SpaceGrotesk_500Medium',
      semibold: 'SpaceGrotesk_600SemiBold',
      bold: 'SpaceGrotesk_700Bold',
    },
    sans: {
      regular: 'PlusJakartaSans_400Regular',
      medium: 'PlusJakartaSans_500Medium',
      semibold: 'PlusJakartaSans_600SemiBold',
      bold: 'PlusJakartaSans_700Bold',
    },
  },
} as const

// ZYPH "Cockpit" palette: warm paper canvas + ink foreground, with the real logo
// indigo as the single accent. Green/red are reserved strictly for share-aware money.
// live = event in progress; raised = floating surface / focused input; bezel = ink tab bar.
const lightTheme = {
  colors: {
    background: '#F4F1E8',
    foreground: '#1A1712',
    card: '#FBF9F2',
    border: '#E6E0D2',
    primary: '#4F46E5',
    primaryForeground: '#FFFFFF',
    accent: '#4F46E5',
    accentDeep: '#6366F1',
    muted: '#8C8578',
    success: '#2F7D57',
    warning: '#C98A2B',
    destructive: '#C8482C',
    // Fixed (theme-independent) live green, dark enough for white text to clear ~4.5:1 in both
    // themes; kept green so the badge stays consistent with the "in progress" semantic.
    live: '#2F7D57',
    raised: '#FFFFFF',
    bezel: '#1A1712',
  },
  ...shared,
} as const

const darkTheme = {
  colors: {
    background: '#161310',
    foreground: '#F4F1E8',
    card: '#211C16',
    border: '#322A20',
    primary: '#7C74F0',
    primaryForeground: '#FFFFFF',
    accent: '#7C74F0',
    accentDeep: '#818CF8',
    muted: '#9A9384',
    success: '#5FB98C',
    warning: '#D8A24A',
    destructive: '#E2674A',
    // Fixed (theme-independent) live green: same value as light so white text clears ~4.5:1 here
    // too, and a money-green "positive balance" pill can't be mistaken for the live badge.
    live: '#2F7D57',
    raised: '#211C16',
    bezel: '#211C16',
  },
  ...shared,
} as const

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
}

// Mobile-first breakpoints.
const breakpoints = {
  xs: 0,
  sm: 360,
  md: 480,
  lg: 768,
  xl: 1024,
} as const

type AppThemes = typeof appThemes
type AppBreakpoints = typeof breakpoints

declare module 'react-native-unistyles' {
  // Module augmentation requires empty interfaces extending the app types.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  settings: { adaptiveThemes: true },
  themes: appThemes,
  breakpoints,
})

// Apply the saved theme preference (overrides adaptive if light/dark was chosen).
applyThemePreference(getThemePreference())
