import { DarkTheme, DefaultTheme } from 'expo-router'

import { buildNavigationTheme } from './navigation-theme'

describe('buildNavigationTheme', () => {
  it('paints the navigation background with the app background in light mode', () => {
    const theme = buildNavigationTheme('#F4F1E8', false)

    expect(theme.dark).toBe(false)
    expect(theme.colors.background).toBe('#F4F1E8')
    expect(theme.colors.background).not.toBe(DefaultTheme.colors.background)
  })

  it('starts from the dark navigation palette in dark mode', () => {
    const theme = buildNavigationTheme('#161310', true)

    expect(theme.dark).toBe(true)
    expect(theme.colors.background).toBe('#161310')
    expect(theme.colors.card).toBe(DarkTheme.colors.card)
  })
})
