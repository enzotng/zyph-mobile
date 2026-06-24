import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  buildTripContext,
  type ChatMessage,
  type CopilotMessage,
  CopilotWidget,
  classifyCopilotError,
  clearCopilotHistory,
  loadCopilotHistory,
  saveCopilotHistory,
  useAskCopilot,
  useExecuteCopilotAction,
} from '@/features/copilot'
import { useExpenses, useTripBalances } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { usePackingItems } from '@/features/packing'
import { useSettlements } from '@/features/settlements'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { useTripWeather } from '@/features/weather'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

// Suggested starter questions (i18n keys under copilot.suggestions.*). The label is both
// shown and sent as the question, so the model answers it from the trip context.
const SUGGESTIONS = ['owe', 'next', 'topPayer', 'airport'] as const

// The edge function rejects a payload with more turns than this, so the sent history is trimmed
// to the most recent ones (the last turn is always the new user question).
const MAX_SENT_MESSAGES = 30

// Next collision-free id derived from the current list (ids are `m<n>`). Computed from the list
// rather than a seeded ref counter, so a restored conversation can never produce a duplicate id.
function nextMessageId(list: ChatMessage[]): string {
  const max = list.reduce((acc, message) => Math.max(acc, Number(message.id.slice(1)) || 0), 0)
  return `m${max + 1}`
}

// Zo's mark: a sparkles glyph in a primary circle.
function ZoAvatar({ size }: { size: number }) {
  const { theme } = useUnistyles()
  return (
    <View
      style={[
        styles.zoAvatar,
        { width: size, height: size, borderRadius: Math.round(size * 0.34) },
      ]}
    >
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
  // Enrichment data: included in the context when ready, but never gates sending (weather can be
  // slow or absent), so Zo stays answerable as soon as the core trip data resolves.
  const packing = usePackingItems(tripId)
  const settlements = useSettlements(tripId)
  const weather = useTripWeather(trip.data)
  const ask = useAskCopilot()
  const execute = useExecuteCopilotAction(tripId)
  const { session } = useAuth()
  const myUserId = session?.user.id ?? ''

  // Restore the persisted conversation once (lazy initialiser, runs on mount only).
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadCopilotHistory(tripId))
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<ScrollView>(null)
  // Ids whose action is being executed, tracked synchronously so a double-tap cannot fire the
  // mutation twice before the 'executing' state has re-rendered (a stale-closure double-write).
  const inFlight = useRef<Set<string>>(new Set())

  // Persist the conversation per trip so it survives leaving the screen or restarting the app.
  useEffect(() => {
    saveCopilotHistory(tripId, messages)
  }, [tripId, messages])

  const dataReady = Boolean(
    trip.data && events.data && expenses.data && balances.data && members.data,
  )
  // If any core query fails the chat can never become usable, so surface a retry instead of
  // leaving the suggestions silently disabled forever.
  const coreError =
    trip.isError || events.isError || expenses.isError || balances.isError || members.isError
  function retryCore() {
    void trip.refetch()
    void events.refetch()
    void expenses.refetch()
    void balances.refetch()
    void members.refetch()
  }

  // Sends a conversation whose last turn is the user's question to the copilot. Used by both a
  // fresh send and a retry (which re-sends the failed question without duplicating the bubble).
  function runAsk(convo: ChatMessage[]) {
    if (!trip.data || !events.data || !expenses.data || !balances.data || !members.data) {
      return
    }
    // History drops error bubbles and any action card that is not yet done (pending, executing,
    // cancelled), so the model never echoes a proposal as a turn but stays aware of what it did.
    const history: CopilotMessage[] = convo
      .filter((message) => !message.error && !(message.action && message.actionState !== 'done'))
      .map((message) => ({ role: message.role, content: message.text }))
    if (history.length === 0) {
      return
    }
    // Trim to the edge function's cap, keeping the most recent turns (the last is the question).
    const sendable = history.slice(-MAX_SENT_MESSAGES)
    const retryText = sendable[sendable.length - 1].content

    const context = buildTripContext({
      trip: trip.data,
      members: members.data,
      events: events.data,
      expenses: expenses.data,
      balances: balances.data,
      packing: packing.data ?? [],
      settlements: settlements.data ?? [],
      weather: weather.data ?? null,
    })
    const language = i18n.language === 'fr' ? 'fr' : 'en'

    ask.mutate(
      { context, language, messages: sendable },
      {
        onSuccess: (res) => {
          setMessages((prev) => {
            const id = nextMessageId(prev)
            return [
              ...prev,
              res.action
                ? {
                    id,
                    role: 'assistant',
                    text: res.action.text,
                    action: res.action,
                    actionState: 'pending',
                  }
                : { id, role: 'assistant', text: res.answer ?? '', widget: res.widget },
            ]
          })
        },
        onError: (error) => {
          const kind = classifyCopilotError(error)
          const text =
            kind === 'rateLimited'
              ? t('copilot.rateLimited')
              : kind === 'offline'
                ? t('copilot.offline')
                : t('copilot.error')
          setMessages((prev) => [
            ...prev,
            { id: nextMessageId(prev), role: 'assistant', text, error: true, retryText },
          ])
        },
      },
    )
  }

  function send(question: string) {
    const q = question.trim()
    if (!q || ask.isPending || !dataReady) {
      return
    }
    haptics.light()
    const convo: ChatMessage[] = [
      ...messages,
      { id: nextMessageId(messages), role: 'user', text: q },
    ]
    setMessages(convo)
    setDraft('')
    runAsk(convo)
  }

  // Re-sends the question behind an error bubble: drop the bubble (and anything after it) and ask
  // again, so a transient rate-limit/offline blip is one tap to recover from.
  function retry(message: ChatMessage) {
    if (ask.isPending || !dataReady) {
      return
    }
    const index = messages.findIndex((m) => m.id === message.id)
    if (index < 0) {
      return
    }
    const convo = messages.slice(0, index)
    if (convo.length === 0 || convo[convo.length - 1].role !== 'user') {
      return
    }
    setMessages(convo)
    runAsk(convo)
  }

  function clearChat() {
    if (messages.length === 0) {
      return
    }
    Alert.alert(t('copilot.clearTitle'), t('copilot.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setMessages([])
          clearCopilotHistory(tripId)
        },
      },
    ])
  }

  function setActionState(id: string, actionState: ChatMessage['actionState']) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, actionState } : m)))
  }

  function confirmAction(message: ChatMessage) {
    // Guard against a double-tap (or a tap on an already-executing/resolved card) writing twice.
    // The ref check is synchronous, so it holds even before 'executing' has re-rendered.
    if (message.actionState !== 'pending' || inFlight.current.has(message.id)) {
      return
    }
    if (!message.action || !trip.data || !members.data || !myUserId) {
      return
    }
    inFlight.current.add(message.id)
    haptics.light()
    setActionState(message.id, 'executing')
    execute.mutate(
      {
        action: message.action,
        members: members.data,
        myUserId,
        trip: trip.data,
        language: i18n.language === 'fr' ? 'fr' : 'en',
      },
      {
        onSuccess: () => {
          inFlight.current.delete(message.id)
          setActionState(message.id, 'done')
        },
        onError: () => {
          inFlight.current.delete(message.id)
          setActionState(message.id, 'pending')
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(prev),
              role: 'assistant',
              text: t('copilot.actionError'),
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
            <Surface
              radius={theme.radius.md}
              color={theme.colors.card}
              borderColor={theme.colors.border}
              borderWidth={1}
              style={styles.backTile}
            >
              <Ionicons name="chevron-back" size={20} color={theme.colors.foreground} />
            </Surface>
          </Pressable>
          <ZoAvatar size={38} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('copilot.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('copilot.subtitle')}</Text>
          </View>
          {messages.length > 0 ? (
            <Pressable
              onPress={clearChat}
              accessibilityRole="button"
              accessibilityLabel={t('copilot.clear')}
              hitSlop={8}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                {coreError && !dataReady ? (
                  <>
                    <Text style={styles.emptyText}>{t('errors.body')}</Text>
                    <Button
                      label={t('common.retry')}
                      icon="refresh"
                      variant="secondary"
                      block={false}
                      onPress={retryCore}
                    />
                  </>
                ) : !dataReady ? (
                  <>
                    <Spinner />
                    <Text style={styles.emptyText}>{t('common.loading')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyText}>{t('copilot.empty')}</Text>
                    <View style={styles.suggestions}>
                      {SUGGESTIONS.map((key) => {
                        const label = t(`copilot.suggestions.${key}`)
                        return (
                          <Pressable
                            key={key}
                            onPress={() => send(label)}
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
                  </>
                )}
              </View>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user'
                return (
                  // Plain ScrollView map (not a recycling list), so a simple mount entrance is safe.
                  <Animated.View key={message.id} entering={FadeInDown.duration(240)}>
                    <View
                      style={[
                        styles.bubbleRow,
                        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                      ]}
                    >
                      {isUser ? null : <ZoAvatar size={26} />}
                      <Surface
                        radius={18}
                        color={isUser ? theme.colors.primary : theme.colors.card}
                        borderColor={isUser ? theme.colors.primary : theme.colors.border}
                        borderWidth={1}
                        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
                      >
                        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleText}>
                          {message.text}
                        </Text>
                        {message.action ? (
                          message.actionState === 'pending' ? (
                            <View style={styles.actionButtons}>
                              <Button
                                label={t('copilot.confirm')}
                                size="sm"
                                block={false}
                                // Scoped to this card: confirming flips it to 'executing' (the spinner
                                // branch) right away, so a sibling card running never disables this one.
                                onPress={() => confirmAction(message)}
                              />
                              <Button
                                label={t('common.cancel')}
                                variant="ghost"
                                size="sm"
                                block={false}
                                onPress={() => setActionState(message.id, 'cancelled')}
                              />
                            </View>
                          ) : message.actionState === 'executing' ? (
                            <View style={styles.actionStatusRow}>
                              <Spinner label={t('copilot.actionRunning')} />
                            </View>
                          ) : (
                            <Text style={styles.actionStatus}>
                              {message.actionState === 'done'
                                ? `✓ ${t('copilot.actionDone')}`
                                : t('copilot.actionCancelled')}
                            </Text>
                          )
                        ) : null}
                        {message.error && message.retryText ? (
                          <Pressable
                            onPress={() => retry(message)}
                            disabled={ask.isPending}
                            accessibilityRole="button"
                            accessibilityLabel={t('copilot.retry')}
                            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                          >
                            <Text style={styles.retryText}>{t('copilot.retry')}</Text>
                          </Pressable>
                        ) : null}
                      </Surface>
                    </View>
                    {message.widget ? (
                      <View style={styles.widgetRow}>
                        <CopilotWidget type={message.widget} tripId={tripId} />
                      </View>
                    ) : null}
                  </Animated.View>
                )
              })
            )}
            {ask.isPending ? (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <ZoAvatar size={26} />
                <Surface
                  radius={18}
                  color={theme.colors.card}
                  borderColor={theme.colors.border}
                  borderWidth={1}
                  style={[styles.bubble, styles.bubbleAssistant]}
                >
                  <Spinner label={t('copilot.thinking')} />
                </Surface>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.composer}>
            <Text style={styles.disclaimer}>{t('copilot.disclaimer')}</Text>
            <Surface
              radius={18}
              color={theme.colors.raised}
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
                accessibilityState={{ disabled: !canSend }}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}
              >
                <View
                  style={[
                    styles.sendButton,
                    { backgroundColor: canSend ? theme.colors.primary : theme.colors.muted },
                    !canSend && styles.sendButtonDisabled,
                  ]}
                >
                  <Ionicons name="arrow-up" size={22} color={theme.colors.primaryForeground} />
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
    borderCurve: 'continuous',
  },
  backTile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flexShrink: 1,
  },
  headerAction: {
    marginLeft: 'auto',
    padding: theme.gap(1),
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
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderTopLeftRadius: 4,
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    marginTop: theme.gap(2.5),
  },
  actionStatus: {
    marginTop: theme.gap(2),
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  actionStatusRow: {
    marginTop: theme.gap(2),
  },
  retryText: {
    marginTop: theme.gap(2),
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  // Aligns the widget card under the assistant bubble (clears the 26px avatar + its row gap).
  widgetRow: {
    marginTop: theme.gap(2),
    marginLeft: 26 + theme.gap(2),
  },
  composer: {
    paddingHorizontal: theme.gap(4),
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(2),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  disclaimer: {
    textAlign: 'center',
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    marginBottom: theme.gap(2),
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
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
}))
