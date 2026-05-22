import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { setOnboardingSeen } from '@/lib/preferences'

const SLIDES = [
  {
    key: 'plan',
    title: 'Plan together',
    body: 'Create a trip and invite friends with a single code.',
  },
  {
    key: 'spend',
    title: 'Track spending',
    body: 'Add shared expenses and instantly see who owes what.',
  },
  {
    key: 'offline',
    title: 'Travel offline',
    body: 'Your trips stay with you, even without a signal.',
  },
] as const

export default function OnboardingScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [page, setPage] = useState(0)

  function finish() {
    setOnboardingSeen()
    router.replace('/(auth)/sign-in')
  }

  function onMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width))
  }

  const isLast = page === SLIDES.length - 1

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, index) => (
          <View key={slide.key} style={[styles.dot, index === page ? styles.dotActive : null]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button label={isLast ? 'Get started' : 'Skip'} onPress={finish} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom + theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
    paddingHorizontal: theme.gap(8),
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
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
    backgroundColor: theme.colors.primary,
  },
  footer: {
    paddingHorizontal: theme.gap(6),
  },
}))
