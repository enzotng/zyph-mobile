import { StyleSheet } from 'react-native-unistyles'

import { applyThemePreference, getThemePreference } from './lib/preferences'

// Spacing helper + radius/typography scales shared across themes.
const shared = {
  gap: (v: number) => v * 4,
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 34 },
} as const

// ZYPH brand palette (purple), carried over from the original design.
const lightTheme = {
  colors: {
    background: '#FFFFFF',
    foreground: '#0F172A',
    card: '#F8FAFC',
    border: '#E2E8F0',
    primary: '#7C3AED',
    primaryForeground: '#FFFFFF',
    accent: '#818CF8',
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
    primary: '#8B5CF6',
    primaryForeground: '#FFFFFF',
    accent: '#A5B4FC',
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
