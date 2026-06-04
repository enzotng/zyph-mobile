import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Spinner, Surface } from '@/components/ui'
import { buildTripContext, type CopilotMessage, useAskCopilot } from '@/features/copilot'
import { useExpenses, useTripBalances } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

// Suggested starter questions (i18n keys under copilot.suggestions.*). The label is both
// shown and sent as the question, so the model answers it from the trip context.
const SUGGESTIONS = ['owe', 'next', 'topPayer', 'airport'] as const

// Header height below the safe-area top inset, for the keyboard avoiding offset.
const HEADER_HEIGHT = 54

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; error?: boolean }

// Zo's mark: a sparkles glyph in a primary circle.
function ZoAvatar({ size }: { size: number }) {
  const { theme } = useUnistyles()
  return (
    <View style={[styles.zoAvatar, { width: size, height: size, borderRadius: size }]}>
      <Ionicons
        name="sparkles"
        size={Math.round(size * 0.5)}
        color={theme.colors.primaryForeground}
      />
    </View>
  )
}

export default function CopilotScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()

  // Zoom-in pop on open (the route uses a fade, so no horizontal slide).
  const enter = useSharedValue(0)
  useEffect(() => {
    enter.value = withTiming(1, { duration: 260, easing: Easing.bezier(0.32, 0.72, 0, 1) })
  }, [enter])
  const enterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + enter.value * 0.08 }],
  }))

  const trip = useTrip(tripId)
  const events = useEvents(tripId)
  const expenses = useExpenses(tripId)
  const balances = useTripBalances(tripId)
  const members = useTripMembers(tripId)
  const ask = useAskCopilot()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const idCounter = useRef(0)
  const scrollRef = useRef<ScrollView>(null)

  const dataReady = Boolean(
    trip.data && events.data && expenses.data && balances.data && members.data,
  )

  function send(question: string) {
    const q = question.trim()
    if (!q || ask.isPending) {
      return
    }
    if (!trip.data || !events.data || !expenses.data || !balances.data || !members.data) {
      return
    }

    // History excludes error bubbles so the model never treats an error as its own turn.
    const history: CopilotMessage[] = messages
      .filter((message) => !message.error)
      .map((message) => ({ role: message.role, content: message.text }))

    idCounter.current += 1
    setMessages((prev) => [...prev, { id: `m${idCounter.current}`, role: 'user', text: q }])
    setDraft('')

    const context = buildTripContext({
      trip: trip.data,
      members: members.data,
      events: events.data,
      expenses: expenses.data,
      balances: balances.data,
    })
    const language = i18n.language === 'fr' ? 'fr' : 'en'

    ask.mutate(
      { context, language, messages: [...history, { role: 'user', content: q }] },
      {
        onSuccess: (res) => {
          idCounter.current += 1
          setMessages((prev) => [
            ...prev,
            { id: `m${idCounter.current}`, role: 'assistant', text: res.answer },
          ])
        },
        onError: () => {
          idCounter.current += 1
          setMessages((prev) => [
            ...prev,
            {
              id: `m${idCounter.current}`,
              role: 'assistant',
              text: t('copilot.error'),
              error: true,
            },
          ])
        },
      },
    )
  }

  const canSend = draft.trim().length > 0 && !ask.isPending && dataReady

  return (
    <Animated.View style={[styles.flex, enterStyle]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Ionicons name="chevron-back" size={26} color={theme.colors.foreground} />
          </Pressable>
          <ZoAvatar size={38} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('copilot.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('copilot.subtitle')}</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + HEADER_HEIGHT}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.empty}>
                <ZoAvatar size={64} />
                <Text style={styles.emptyText}>{t('copilot.empty')}</Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((key) => {
                    const label = t(`copilot.suggestions.${key}`)
                    return (
                      <Pressable
                        key={key}
                        onPress={() => send(label)}
                        disabled={!dataReady}
                        accessibilityRole="button"
                        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                      >
                        <Surface
                          radius={theme.radius.full}
                          color={theme.colors.card}
                          borderColor={theme.colors.border}
                          borderWidth={1}
                          style={styles.suggestion}
                        >
                          <Text style={styles.suggestionText}>{label}</Text>
                        </Surface>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user'
                return (
                  <View
                    key={message.id}
                    style={[
                      styles.bubbleRow,
                      isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                    ]}
                  >
                    {isUser ? null : <ZoAvatar size={26} />}
                    <Surface
                      radius={theme.radius.lg}
                      color={isUser ? theme.colors.primary : theme.colors.card}
                      borderColor={isUser ? theme.colors.primary : theme.colors.border}
                      borderWidth={1}
                      style={styles.bubble}
                    >
                      <Text style={isUser ? styles.bubbleTextUser : styles.bubbleText}>
                        {message.text}
                      </Text>
                    </Surface>
                  </View>
                )
              })
            )}
            {ask.isPending ? (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <ZoAvatar size={26} />
                <Surface
                  radius={theme.radius.lg}
                  color={theme.colors.card}
                  borderColor={theme.colors.border}
                  borderWidth={1}
                  style={styles.bubble}
                >
                  <Spinner label={t('copilot.thinking')} />
                </Surface>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.composer}>
            <Surface
              radius={24}
              color={theme.colors.card}
              borderColor={theme.colors.border}
              borderWidth={1}
              style={styles.inputPill}
            >
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('copilot.placeholder')}
                placeholderTextColor={theme.colors.muted}
                multiline
              />
              <Pressable
                onPress={() => send(draft)}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t('copilot.send')}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}
              >
                <View
                  style={[
                    styles.sendButton,
                    { backgroundColor: canSend ? theme.colors.primary : theme.colors.muted },
                  ]}
                >
                  <Ionicons name="arrow-up" size={18} color={theme.colors.primaryForeground} />
                </View>
              </Pressable>
            </Surface>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    paddingTop: rt.insets.top + theme.gap(2),
    paddingBottom: theme.gap(2),
    paddingHorizontal: theme.gap(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  zoAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  headerText: {
    flexShrink: 1,
  },
  headerTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    marginTop: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  messages: {
    flexGrow: 1,
    gap: theme.gap(2),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(4),
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    maxWidth: 300,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.gap(2),
  },
  suggestion: {
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3.5),
  },
  suggestionText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.gap(2),
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(3.5),
  },
  bubbleText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
  },
  bubbleTextUser: {
    color: theme.colors.primaryForeground,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
  },
  composer: {
    paddingHorizontal: theme.gap(4),
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(2),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.gap(2),
    paddingLeft: theme.gap(4),
    paddingRight: theme.gap(1.5),
    paddingVertical: theme.gap(1.5),
  },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingTop: theme.gap(1.5),
    paddingBottom: theme.gap(1.5),
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
}))
