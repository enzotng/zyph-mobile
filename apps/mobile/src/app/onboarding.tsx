import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Eyebrow } from '@/components/ui'
import { setOnboardingSeen } from '@/lib/preferences'

type SlideKey = 'plan' | 'spend' | 'zo'
type Slide = { key: SlideKey; gradient: readonly [string, string, string] }

// One vivid brand gradient per slide (matches the Lot 6 vignettes), used in both themes.
const SLIDES: Slide[] = [
  { key: 'plan', gradient: ['#4F46E5', '#6366F1', '#8B5CF6'] },
  { key: 'spend', gradient: ['#0D9488', '#0EA5E9', '#38BDF8'] },
  { key: 'zo', gradient: ['#4F46E5', '#8B5CF6', '#DB2777'] },
]

// Fixed illustration palette inside the vignette (a branded poster, not theme-driven).
const INK = '#1A1712'
const PAPER = '#F4F1E8'
const VIGNETTE_MUTED = '#8C8578'
const VIGNETTE_LINE = '#E6E0D2'
const GREEN = '#2F7D57'
const INDIGO = '#4F46E5'

export default function OnboardingScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [page, setPage] = useState(0)

  const slide = SLIDES[page]
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
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          hitSlop={8}
        >
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <Animated.View
        key={`vignette-${slide.key}`}
        entering={FadeInDown.duration(320)}
        style={styles.vignetteWrap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LinearGradient
          colors={slide.gradient}
          locations={[0, 0.6, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.vignette}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0)']}
            style={styles.highlight}
            pointerEvents="none"
          />
          <Vignette slideKey={slide.key} />
        </LinearGradient>
      </Animated.View>

      <Animated.View
        key={`copy-${slide.key}`}
        entering={FadeInDown.delay(80).duration(320)}
        style={styles.bottom}
      >
        <Text style={styles.title}>{t(`onboarding.${slide.key}.title`)}</Text>
        <Text style={styles.body}>{t(`onboarding.${slide.key}.body`)}</Text>

        <View style={styles.dots}>
          {SLIDES.map((s, index) => (
            <Pressable
              key={s.key}
              onPress={() => setPage(index)}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.goToSlide', { index: index + 1 })}
              accessibilityState={{ selected: index === page }}
              hitSlop={18}
            >
              <View style={[styles.dot, index === page && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        <Button
          variant={isLast ? 'accent' : 'primary'}
          label={isLast ? t('onboarding.start') : t('onboarding.next')}
          onPress={next}
        />
      </Animated.View>
    </View>
  )
}

// Per-slide product preview: a timeline, a Smart Split card, or Zo suggestions.
function Vignette({ slideKey }: { slideKey: SlideKey }) {
  const { t } = useTranslation()

  if (slideKey === 'plan') {
    return (
      <View style={styles.card}>
        <Eyebrow style={styles.eyebrow}>{t('onboarding.demo.day')}</Eyebrow>
        <View style={styles.cardRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(95, 185, 140, 0.16)' }]}>
            <Ionicons name="train" size={17} color={GREEN} />
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {t('onboarding.demo.eventTram')}
          </Text>
          <Text style={[styles.rowMeta, { color: GREEN }]}>{t('onboarding.demo.now')}</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(79, 70, 229, 0.1)' }]}>
            <Ionicons name="restaurant" size={17} color={INDIGO} />
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {t('onboarding.demo.eventDinner')}
          </Text>
          <Text style={[styles.rowMeta, styles.rowMetaNum]}>{t('onboarding.demo.dinnerEta')}</Text>
        </View>
      </View>
    )
  }

  if (slideKey === 'spend') {
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.merchant}>{t('onboarding.demo.merchant')}</Text>
          <Text style={styles.amount}>€62.40</Text>
        </View>
        <View style={styles.avatars}>
          {[
            { id: 'E', color: '#4F46E5' },
            { id: 'M', color: '#0EA5E9' },
            { id: 'L', color: '#0D9488' },
            { id: 'S', color: '#8B5CF6' },
          ].map((a) => (
            <View key={a.id} style={[styles.avatar, { backgroundColor: a.color }]}>
              <Text style={styles.avatarText}>{a.id}</Text>
            </View>
          ))}
        </View>
        <View style={styles.shareRow}>
          <Text style={styles.shareLabel}>{t('onboarding.demo.yourShare')}</Text>
          <Text style={[styles.shareValue, { color: GREEN }]}>€15.60</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.zoHead}>
        <View style={styles.zoMark}>
          <Ionicons name="sparkles" size={15} color="#FFFFFF" />
        </View>
        <Text style={styles.zoName}>{t('onboarding.demo.zoSuggests')}</Text>
      </View>
      <View style={styles.cardRow}>
        <View style={[styles.rowIcon, { backgroundColor: 'rgba(79, 70, 229, 0.1)' }]}>
          <Ionicons name="restaurant" size={17} color={INDIGO} />
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {t('onboarding.demo.zoIdea1')}
        </Text>
        <Text style={[styles.rowMeta, styles.rowMetaNum]}>{t('onboarding.demo.zoIdea1Meta')}</Text>
      </View>
      <View style={styles.cardRow}>
        <View style={[styles.rowIcon, { backgroundColor: 'rgba(216, 39, 119, 0.12)' }]}>
          <Ionicons name="walk" size={17} color="#DB2777" />
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {t('onboarding.demo.zoIdea2')}
        </Text>
        <Text style={[styles.rowMeta, styles.rowMetaNum]}>{t('onboarding.demo.zoIdea2Meta')}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    paddingTop: rt.insets.top + theme.gap(1),
    paddingBottom: rt.insets.bottom + theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.gap(6),
    paddingVertical: theme.gap(2),
  },
  skip: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  vignetteWrap: {
    flex: 1,
    marginHorizontal: theme.gap(4.5),
    marginTop: theme.gap(1),
  },
  vignette: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.gap(6),
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  bottom: {
    paddingHorizontal: theme.gap(7),
    paddingTop: theme.gap(5),
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  body: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: theme.gap(2),
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.75),
    marginTop: theme.gap(5),
    marginBottom: theme.gap(4),
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.colors.primary,
  },
  // --- vignette preview card (fixed branded palette) ---
  card: {
    alignSelf: 'stretch',
    backgroundColor: PAPER,
    borderRadius: 16,
    padding: theme.gap(3.5),
    gap: theme.gap(2.5),
    shadowColor: INK,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    color: VIGNETTE_MUTED,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: 13,
    color: INK,
  },
  rowMeta: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: 11,
  },
  rowMetaNum: {
    fontFamily: theme.fonts.display.bold,
    color: INDIGO,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  merchant: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: 13,
    color: INK,
  },
  amount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 14,
    color: INK,
  },
  avatars: {
    flexDirection: 'row',
    gap: theme.gap(1.5),
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 11,
    color: '#FFFFFF',
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.gap(2.5),
    borderTopWidth: 1,
    borderTopColor: VIGNETTE_LINE,
  },
  shareLabel: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: 12,
    color: VIGNETTE_MUTED,
  },
  shareValue: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 13,
  },
  // --- slide zo (copilot) ---
  zoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  zoMark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoName: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 13,
    color: INK,
  },
}))
