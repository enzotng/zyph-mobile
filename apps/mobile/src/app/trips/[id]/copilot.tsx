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
  classifyCopilotError,
  clearCopilotHistory,
  loadBlockStates,
  loadCopilotHistory,
  saveBlockStates,
  saveCopilotHistory,
  useAskCopilot,
  useExecuteCopilotAction,
} from '@/features/copilot'
import { type ActionState, CopilotBlocks } from '@/features/copilot/components/copilot-blocks'
import type { Block, Chip, NavTarget } from '@/features/copilot/schemas'
import { useExpenses, useTripBalances } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { usePackingItems } from '@/features/packing'
import { type Poi, searchPois } from '@/features/places'
import { useSettlements } from '@/features/settlements'
import { type NewItineraryEvent, useCreateEvents, useEvents } from '@/features/timeline'
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

// Keywords that hint the user wants a day-by-day itinerary plan. If the message matches any of
// these, candidates are fetched from the POI search and forwarded to the copilot edge function.
const PLANNING_HINTS = [
  'plan',
  'itinerary',
  'itinerar',
  'itinéraire',
  'itineraire',
  'programme',
  'program',
  'schedule',
  'organiz',
  'organis',
  'what to do',
  'things to do',
  'que faire',
  'quoi faire',
  'fill',
  'remplis',
  'day by day',
  'jour par jour',
  'visit',
  'visiter',
  'replan',
  'replanifie',
]

function looksLikePlanning(text: string): boolean {
  const lower = text.toLowerCase()
  return PLANNING_HINTS.some((h) => lower.includes(h))
}

// Maps trip interest keys (stored as strings in the DB) to Google Places types. Always
// includes a base set so the model has candidates even when no interests are configured.
const INTEREST_GOOGLE_TYPES: Record<string, string[]> = {
  food: ['restaurant'],
  nightlife: ['bar', 'night_club'],
  museums: ['museum'],
  nature: ['park'],
  shopping: ['shopping_mall'],
  sports: ['stadium'],
  history: ['historical_landmark'],
  art: ['art_gallery'],
  music: ['performing_arts_theater'],
  photography: ['tourist_attraction'],
  relaxation: ['spa'],
  local_culture: ['tourist_attraction'],
}

function googleTypesFor(interests: string[]): string[] {
  const set = new Set<string>(['restaurant', 'tourist_attraction'])
  for (const interest of interests) {
    for (const googleType of INTEREST_GOOGLE_TYPES[interest] ?? []) {
      set.add(googleType)
    }
  }
  // The poi-search edge function caps includedTypes at 10.
  return Array.from(set).slice(0, 10)
}

// Maps each NavTarget to its expo-router pathname. The (tabs) group is omitted from the URL
// since expo-router treats parenthesised groups as transparent.
const NAV_HREFS = {
  trip_home: '/trips/[id]',
  spend: '/trips/[id]/expenses',
  timeline: '/trips/[id]/timeline',
  packing: '/trips/[id]/packing',
  map: '/trips/[id]/pois', // POIs tab - primary map surface (not the /map wayfinder stack)
  balances: '/trips/[id]/balances',
  group: '/trips/[id]/group',
} as const satisfies Record<NavTarget, string>

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
  const params = useGlobalSearchParams<{ id: string; prompt?: string }>()
  const tripId = paramString(params.id)
  const initialPrompt = paramString(params.prompt)
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

  // Per-block action states: key = `${messageId}:${blockIndex}`. Re-hydrated from storage so an
  // already-executed action card can never re-arm as tappable after a restart (the chat history
  // persists, so without this the restored card would read 'pending' again - a financial
  // re-execution hazard).
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    () => loadBlockStates(tripId).actions,
  )

  // Per-block itinerary add states: key = `${messageId}:${blockIndex}`. Re-hydrated for the same
  // reason: an added itinerary must keep reading "Added" across restarts.
  const [itineraryStates, setItineraryStates] = useState<Record<string, 'adding' | 'added'>>(
    () => loadBlockStates(tripId).itineraries,
  )

  // POI candidates from the most recent planning search; passed to every itinerary block so
  // each card can show photos, ratings and coordinates even after more messages are sent.
  const [candidates, setCandidates] = useState<Poi[]>([])

  // The last user message text that triggered a planning search; re-used by onRegenerateItinerary
  // so tapping Regenerate re-sends the same prompt through the normal send path.
  const lastPlanningPromptRef = useRef<string>('')

  // Block-scoped in-flight guard: synchronous so a double-tap cannot fire the mutation twice
  // before 'executing' has re-rendered (a stale-closure double-write).
  const inFlight = useRef<Set<string>>(new Set())

  const createEvents = useCreateEvents()

  const actionStateFor = (messageId: string, index: number): ActionState =>
    actionStates[`${messageId}:${index}`] ?? 'pending'

  const setBlockActionState = (messageId: string, index: number, s: ActionState) => {
    setActionStates((prev) => ({ ...prev, [`${messageId}:${index}`]: s }))
  }

  // Persist the conversation per trip so it survives leaving the screen or restarting the app.
  useEffect(() => {
    saveCopilotHistory(tripId, messages)
  }, [tripId, messages])

  // Persist the per-block outcomes alongside the chat (executed actions, added itineraries) so
  // they survive a restart too. Transient values ('executing'/'adding') are coerced or dropped
  // at load time by loadBlockStates. Keys whose message no longer exists (history trimmed at
  // MAX_STORED, or an error bubble replaced) are pruned so the stored map stays bounded like
  // the chat itself.
  useEffect(() => {
    const liveIds = new Set(messages.map((m) => m.id))
    const prune = <T extends Record<string, string>>(states: T): T =>
      Object.fromEntries(
        Object.entries(states).filter(([k]) => liveIds.has(k.slice(0, k.lastIndexOf(':')))),
      ) as T
    saveBlockStates(tripId, prune(actionStates), prune(itineraryStates))
  }, [tripId, messages, actionStates, itineraryStates])

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

  // Auto-send the initial prompt from a deep-link CTA exactly once on mount.
  // The ref guard ensures the effect fires only once even across re-renders,
  // query refetches, or history rehydration. `send` is a hoisted function declaration
  // so calling it here is safe even though it appears later in the file.
  const autoSentRef = useRef(false)
  useEffect(() => {
    if (autoSentRef.current || !initialPrompt || !dataReady || ask.isPending) {
      return
    }
    autoSentRef.current = true
    send(initialPrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, dataReady, ask.isPending])

  // Sends a conversation whose last turn is the user's question to the copilot. Used by both a
  // fresh send and a retry (which re-sends the failed question without duplicating the bubble).
  // The candidate fetch is kicked off inside a fire-and-forget async IIFE so the function
  // signature stays synchronous for its callers (send / retry / onRegenerateItinerary).
  function runAsk(convo: ChatMessage[]) {
    if (!trip.data || !events.data || !expenses.data || !balances.data || !members.data) {
      return
    }
    // Capture for use inside the async closure (stable snapshot of the current render).
    const tripData = trip.data

    // Build history from text blocks only; skip error messages and messages with empty content.
    // Action/widget blocks contribute no text context to the LLM.
    const history: CopilotMessage[] = convo
      .filter((message) => !message.error)
      .map((message) => ({
        role: message.role,
        content: message.blocks
          .filter((b) => b.kind === 'text')
          .map((b) => (b as Extract<Block, { kind: 'text' }>).text)
          .join('\n'),
      }))
      .filter((m) => m.content.length > 0)
    if (history.length === 0) {
      return
    }
    // Trim to the edge function's cap, keeping the most recent turns (the last is the question).
    const sendable = history.slice(-MAX_SENT_MESSAGES)
    const retryText = sendable[sendable.length - 1].content
    const lastUserContent = retryText

    const context = buildTripContext({
      trip: tripData,
      members: members.data,
      events: events.data,
      expenses: expenses.data,
      balances: balances.data,
      packing: packing.data ?? [],
      settlements: settlements.data ?? [],
      weather: weather.data ?? null,
    })
    const language = i18n.language === 'fr' ? 'fr' : 'en'

    void (async () => {
      // Fetch POI candidates when the user seems to be asking for a day plan and the trip
      // has coordinates. Failure is swallowed so a network hiccup never blocks the chat.
      let poiCandidates: Poi[] | undefined
      if (
        looksLikePlanning(lastUserContent) &&
        tripData.latitude !== null &&
        tripData.longitude !== null
      ) {
        const pois = await searchPois({
          lat: tripData.latitude,
          lng: tripData.longitude,
          includedTypes: googleTypesFor(tripData.interests ?? []),
          max: 16,
        }).catch((): Poi[] => [])
        setCandidates(pois)
        lastPlanningPromptRef.current = lastUserContent
        if (pois.length > 0) {
          poiCandidates = pois
        }
      }

      ask.mutate(
        {
          context,
          language,
          messages: sendable,
          ...(poiCandidates ? { candidates: poiCandidates } : {}),
        },
        {
          onSuccess: (res) => {
            setMessages((prev) => {
              const id = nextMessageId(prev)
              return [...prev, { id, role: 'assistant', blocks: res.blocks }]
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
              {
                id: nextMessageId(prev),
                role: 'assistant',
                blocks: [{ kind: 'text', text }],
                error: true,
                retryText,
              },
            ])
          },
        },
      )
    })()
  }

  function send(question: string) {
    const q = question.trim()
    if (!q || ask.isPending || !dataReady) {
      return
    }
    haptics.light()
    const convo: ChatMessage[] = [
      ...messages,
      { id: nextMessageId(messages), role: 'user', blocks: [{ kind: 'text', text: q }] },
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
          setActionStates({})
          setItineraryStates({})
          clearCopilotHistory(tripId)
        },
      },
    ])
  }

  function confirmAction(
    messageId: string,
    index: number,
    block: Extract<Block, { kind: 'action' }>,
  ) {
    const key = `${messageId}:${index}`
    // Guard against a double-tap (or a tap on an already-executing/resolved card) writing twice.
    // The ref check is synchronous, so it holds even before 'executing' has re-rendered.
    if (actionStateFor(messageId, index) !== 'pending' || inFlight.current.has(key)) {
      return
    }
    if (!trip.data || !members.data || !myUserId) {
      return
    }
    inFlight.current.add(key)
    haptics.light()
    setBlockActionState(messageId, index, 'executing')
    // Also persist 'executing' synchronously BEFORE the mutation fires: the reactive persist
    // effect only flushes after the React commit, so if the app were killed in that window the
    // restored card would re-arm as 'pending' while the write may have reached the server.
    // loadBlockStates restores a persisted 'executing' as 'cancelled' (never re-armed).
    saveBlockStates(tripId, { ...actionStates, [key]: 'executing' }, itineraryStates)
    const language = i18n.language === 'fr' ? 'fr' : 'en'
    execute.mutate(
      {
        action: { tool: block.tool, args: block.args, text: block.text },
        members: members.data,
        myUserId,
        trip: trip.data,
        language,
      },
      {
        onSuccess: () => {
          setBlockActionState(messageId, index, 'done')
        },
        onError: () => {
          setBlockActionState(messageId, index, 'pending')
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(prev),
              role: 'assistant',
              blocks: [{ kind: 'text', text: t('copilot.actionError') }],
              error: true,
            },
          ])
        },
        onSettled: () => {
          inFlight.current.delete(key)
        },
      },
    )
  }

  // Batch-creates timeline events from the itinerary block the user reviewed and confirmed.
  // Marks the block as 'adding' optimistically and 'added' on success. On failure, resets the
  // state so the user can try again.
  async function handleAddItinerary(
    messageId: string,
    blockIndex: number,
    events: NewItineraryEvent[],
  ) {
    const key = `${messageId}:${blockIndex}`
    if (itineraryStates[key] === 'added' || inFlight.current.has(key)) {
      return
    }
    inFlight.current.add(key)
    setItineraryStates((prev) => ({ ...prev, [key]: 'adding' }))
    try {
      await createEvents.mutateAsync({ tripId, events })
      setItineraryStates((prev) => ({ ...prev, [key]: 'added' }))
      haptics.success()
    } catch {
      setItineraryStates((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      haptics.error()
      Alert.alert(t('errors.title'), t('copilot.actionError'))
    } finally {
      inFlight.current.delete(key)
    }
  }

  // Re-sends the last planning prompt through the normal send path, which re-fetches candidates
  // and re-asks the edge function. If no planning prompt has been recorded, this is a no-op.
  function onRegenerateItinerary() {
    if (!lastPlanningPromptRef.current) {
      return
    }
    send(lastPlanningPromptRef.current)
  }

  function onChip(chip: Chip) {
    switch (chip.action) {
      case 'navigate':
        haptics.selection()
        router.navigate({
          pathname: NAV_HREFS[chip.to] as '/trips/[id]',
          params: { id: tripId },
        })
        break
      case 'prompt':
        send(chip.prompt)
        break
      case 'tool':
        setMessages((prev) => {
          const id = nextMessageId(prev)
          return [
            ...prev,
            {
              id,
              role: 'assistant',
              blocks: [{ kind: 'action', tool: chip.tool, args: chip.args, text: chip.label }],
            },
          ]
        })
        break
    }
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
                      {isUser ? (
                        <Surface
                          radius={18}
                          color={theme.colors.primary}
                          borderColor={theme.colors.primary}
                          borderWidth={1}
                          style={[styles.bubble, styles.bubbleUser]}
                        >
                          <Text style={styles.bubbleTextUser}>
                            {message.blocks
                              .filter((b) => b.kind === 'text')
                              .map((b) => (b as Extract<Block, { kind: 'text' }>).text)
                              .join('\n')}
                          </Text>
                        </Surface>
                      ) : (
                        <View style={styles.assistantColumn}>
                          <CopilotBlocks
                            blocks={message.blocks}
                            tripId={tripId}
                            messageId={message.id}
                            actionStateFor={(i) => actionStateFor(message.id, i)}
                            onConfirm={(i, b) => confirmAction(message.id, i, b)}
                            onCancel={(i) => setBlockActionState(message.id, i, 'cancelled')}
                            onChip={onChip}
                            executePending={execute.isPending}
                            candidates={candidates}
                            itineraryStateFor={(i) => itineraryStates[`${message.id}:${i}`]}
                            onAddItinerary={(i, evts) => {
                              void handleAddItinerary(message.id, i, evts)
                            }}
                            onRegenerateItinerary={onRegenerateItinerary}
                          />
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
                        </View>
                      )}
                    </View>
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
  assistantColumn: {
    flex: 1,
    gap: theme.gap(1),
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
  retryText: {
    marginTop: theme.gap(2),
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
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
    alignItems: 'center',
    gap: theme.gap(2),
    paddingLeft: theme.gap(4),
    paddingRight: theme.gap(1.5),
    paddingVertical: theme.gap(1),
  },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingVertical: theme.gap(1),
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
