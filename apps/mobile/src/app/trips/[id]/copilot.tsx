import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner, Squircle } from '@/components/ui'
import { buildTripContext, type CopilotMessage, useAskCopilot } from '@/features/copilot'
import { useExpenses, useTripBalances } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

// Suggested starter questions (i18n keys under copilot.suggestions.*). The label is both
// shown and sent as the question, so the model answers it from the trip context.
const SUGGESTIONS = ['owe', 'next', 'topPayer', 'airport'] as const

// Approx. AppHeader content height (below the safe-area top inset) for the keyboard offset.
const HEADER_HEIGHT = 52

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; error?: boolean }

export default function CopilotScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()

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
    <Screen title={t('copilot.title')} showBack>
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
                      <Squircle
                        radius={theme.radius.full}
                        color={theme.colors.card}
                        borderColor={theme.colors.border}
                        borderWidth={1}
                        style={styles.suggestion}
                      >
                        <Text style={styles.suggestionText}>{label}</Text>
                      </Squircle>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.bubbleRow,
                  message.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                ]}
              >
                <Squircle
                  radius={theme.radius.lg}
                  color={message.role === 'user' ? theme.colors.primary : theme.colors.card}
                  borderColor={message.role === 'user' ? theme.colors.primary : theme.colors.border}
                  borderWidth={1}
                  style={styles.bubble}
                >
                  <Text style={message.role === 'user' ? styles.bubbleTextUser : styles.bubbleText}>
                    {message.text}
                  </Text>
                </Squircle>
              </View>
            ))
          )}
          {ask.isPending ? (
            <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
              <Squircle
                radius={theme.radius.lg}
                color={theme.colors.card}
                borderColor={theme.colors.border}
                borderWidth={1}
                style={styles.bubble}
              >
                <Spinner label={t('copilot.thinking')} />
              </Squircle>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.composerField}>
            <TextField
              value={draft}
              onChangeText={setDraft}
              placeholder={t('copilot.placeholder')}
              returnKeyType="send"
              onSubmitEditing={() => send(draft)}
            />
          </View>
          <Pressable
            onPress={() => send(draft)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('copilot.send')}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Squircle
              radius={theme.radius.full}
              color={canSend ? theme.colors.primary : theme.colors.muted}
              borderWidth={0}
              style={styles.sendButton}
            >
              <Ionicons name="send" size={18} color={theme.colors.primaryForeground} />
            </Squircle>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  flex: {
    flex: 1,
  },
  messages: {
    flexGrow: 1,
    gap: theme.gap(2),
    paddingVertical: theme.gap(3),
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
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(2),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  composerField: {
    flex: 1,
  },
  sendButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
}))
