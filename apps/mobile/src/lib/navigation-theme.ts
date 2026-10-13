import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

// expo-router paints the native stack container with the navigation theme's background, which
// shows through screen transitions: it has to be the app background, not navigation's grey.
export function buildNavigationTheme(background: string, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme
  return { ...base, colors: { ...base.colors, background } }
}
