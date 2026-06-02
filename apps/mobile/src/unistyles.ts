import { StyleSheet } from 'react-native-unistyles'

import { applyThemePreference, getThemePreference } from './lib/preferences'

// Spacing helper + radius/typography scales shared across themes.
// Radii follow the v2 visual direction (softer corners than v1).
const shared = {
  gap: (v: number) => v * 4,
  radius: { sm: 12, md: 20, lg: 32, xl: 40, full: 9999 },
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

// ZYPH brand palette (v2 indigo/sky). Indigo marks interactive/active surfaces;
// sky is the lighter travel accent; accentDeep is the secondary brand indigo.
const lightTheme = {
  colors: {
    background: '#FFFFFF',
    foreground: '#0F172A',
    card: '#F8FAFC',
    border: '#E2E8F0',
    primary: '#4F46E5',
    primaryForeground: '#FFFFFF',
    accent: '#38BDF8',
    accentDeep: '#6366F1',
    muted: '#64748B',
    success: '#10B981',
    warning: '#F59E0B',
    destructive: '#EF4444',
  },
  ...shared,
} as const

const darkTheme = {
  colors: {
    background: '#0F172A',
    foreground: '#F8FAFC',
    card: '#1E293B',
    border: '#334155',
    primary: '#6366F1',
    primaryForeground: '#FFFFFF',
    accent: '#7DD3FC',
    accentDeep: '#818CF8',
    muted: '#94A3B8',
    success: '#34D399',
    warning: '#FBBF24',
    destructive: '#F87171',
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
