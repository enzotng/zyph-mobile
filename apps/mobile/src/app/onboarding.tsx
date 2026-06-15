import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { Surface } from '@/components/ui'
import { withAlpha } from '@/lib/color'
import { setOnboardingSeen } from '@/lib/preferences'

type Slide = {
  key: 'plan' | 'spend' | 'find'
  icon: keyof typeof Ionicons.glyphMap
  accent: 'primary' | 'accentDeep' | 'accent'
}

const SLIDES: Slide[] = [
  {
    key: 'plan',
    icon: 'map',
    accent: 'primary',
  },
  {
    key: 'spend',
    icon: 'sparkles',
    accent: 'accentDeep',
  },
  {
    key: 'find',
    icon: 'navigate',
    accent: 'accent',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const [page, setPage] = useState(0)

  const slide = SLIDES[page]
  const accent = theme.colors[slide.accent]
  const isLast = page === SLIDES.length - 1

  function finish() {
    setOnboardingSeen()
    router.replace('/(auth)/sign-in')
  }

  function next() {
    if (isLast) {
      finish()
    } else {
      setPage(page + 1)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <BrandLockup size={22} />
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          hitSlop={8}
        >
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroVisual}>
          <View style={[styles.haloOuter, { backgroundColor: withAlpha(accent, 0.12) }]} />
          <View style={[styles.haloInner, { backgroundColor: withAlpha(accent, 0.16) }]} />
          <View style={styles.markGhost}>
            <ZyphMark size={130} color={withAlpha(accent, 0.12)} />
          </View>
          <Surface
            radius={theme.radius.xl}
            color={accent}
            borderWidth={0}
            width={92}
            height={92}
            style={styles.iconTile}
          >
            <Ionicons name={slide.icon} size={46} color="#FFFFFF" />
          </Surface>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{t(`onboarding.${slide.key}.title`)}</Text>
          <Text style={styles.body}>{t(`onboarding.${slide.key}.body`)}</Text>
        </View>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((s, index) => (
          <Pressable
            key={s.key}
            onPress={() => setPage(index)}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.goToSlide', { index: index + 1 })}
            accessibilityState={{ selected: index === page }}
            hitSlop={8}
          >
            <View style={[styles.dot, index === page && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <Button label={isLast ? t('onboarding.start') : t('onboarding.next')} onPress={next} />
      </View>
    </View>
  )
}

function BrandLockup({ size }: { size: number }) {
  return (
    <View style={styles.lockup}>
      <ZyphMark size={size} />
      <Text style={[styles.wordmark, { fontSize: size * 0.82 }]}>ZYPH</Text>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    paddingTop: rt.insets.top + theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(5),
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.gap(5),
    paddingVertical: theme.gap(2),
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  wordmark: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: theme.colors.foreground,
  },
  skip: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.gap(8),
    gap: theme.gap(6),
  },
  heroVisual: {
    width: 188,
    height: 188,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloOuter: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: theme.radius.full,
  },
  haloInner: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: theme.radius.full,
  },
  markGhost: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: theme.gap(3),
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(4),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.colors.primary,
  },
  footer: {
    paddingHorizontal: theme.gap(6),
  },
}))
