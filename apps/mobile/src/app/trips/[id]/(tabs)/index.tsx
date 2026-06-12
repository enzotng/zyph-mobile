import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ScreenCornerRadius } from 'react-native-screen-corner-radius'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import {
  AvatarStack,
  Badge,
  BottomSheet,
  Card,
  CityImage,
  QuickAction,
  SectionTitle,
  Skeleton,
  Surface,
} from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type ExpenseCategory,
  formatAmount,
  settleBalances,
  useExpenses,
  useTripBalances,
} from '@/features/expenses'
import { useLeaveTrip, useRegenerateInviteCode, useTripMembers } from '@/features/group'
import { eventStatus, eventTypeIcon, formatCountdown, useEvents } from '@/features/timeline'
import { formatTripDates, useDeleteTrip, useTrip } from '@/features/trips'
import { useTripWeather, WeatherCard } from '@/features/weather'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

// Staggered entrance for the content blocks below the cover. Short step, capped so the
// last block never lags; the cover hero stays static (its corner-radius logic is untouched).
const ENTER_STEP = 50
const enter = (index: number) => FadeInDown.duration(320).delay(index * ENTER_STEP)

const CATEGORY_ICON: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  transport: 'car',
  lodging: 'bed',
  activity: 'ticket',
  shopping: 'bag-handle',
  other: 'pricetag',
}

// A light top veil (the nav buttons are opaque circles, so it stays subtle to keep the
// status bar legible) and a strong bottom fade for the title, clear in the middle.
const COVER_FADE_COLORS = [
  'rgba(15, 23, 42, 0.3)',
  'rgba(15, 23, 42, 0)',
  'rgba(15, 23, 42, 0)',
  'rgba(15, 23, 42, 0.85)',
] as const
const COVER_FADE_LOCATIONS = [0, 0.25, 0.5, 1] as const

function CoverButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.coverButton, pressed && styles.coverButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Ionicons name={icon} size={20} color="#1E293B" />
    </Pressable>
  )
}

// A row in the trip-actions sheet (opened from the cover ellipsis).
function TripActionRow({
  icon,
  label,
  tone = 'default',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  tone?: 'default' | 'destructive'
  onPress: () => void
}) {
  const { theme } = useUnistyles()
  const color = tone === 'destructive' ? theme.colors.destructive : theme.colors.foreground
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

export default function TripDashboardScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: trip, isLoading, isError } = useTrip(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: events } = useEvents(tripId)
  const { data: expenses } = useExpenses(tripId)
  const { data: weather } = useTripWeather(trip)
  // Snapshot once on mount; the countdown badge does not need to tick on this screen.
  const [now] = useState(() => Date.now())

  const [actionsOpen, setActionsOpen] = useState(false)
  const regenerate = useRegenerateInviteCode(tripId)
  const deleteTripMutation = useDeleteTrip()
  const leaveTripMutation = useLeaveTrip()

  const myMember = useMemo(
    () => (members ?? []).find((member) => member.user_id === userId),
    [members, userId],
  )

  // Suggested settlements derived from the trip balances.
  const settlements = useMemo(
    () =>
      settleBalances(
        (balances ?? []).map((balance) => ({
          memberId: balance.member_id,
          balanceCents: balance.balance_cents ?? 0,
        })),
      ),
    [balances],
  )

  // memberId -> display name, for payer lookups without a per-row members.find.
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of members ?? []) {
      if (member.display_name) {
        map.set(member.id, member.display_name)
      }
    }
    return map
  }, [members])

  const debtorNames = useMemo(
    () =>
      myMember
        ? settlements
            .filter((settlement) => settlement.toMemberId === myMember.id)
            .map((settlement) => nameById.get(settlement.fromMemberId) ?? t('common.member'))
        : [],
    [myMember, settlements, nameById, t],
  )

  const avatarMembers = useMemo(
    () =>
      (members ?? []).map((member) => ({
        id: member.id,
        name: member.display_name ?? undefined,
        imageUrl: member.avatar_url,
      })),
    [members],
  )

  const nextEvent = useMemo(
    () =>
      (events ?? []).find(
        (event) => eventStatus(event.starts_at, event.ends_at, now).kind === 'upcoming',
      ),
    [events, now],
  )

  const recent = useMemo(() => (expenses ?? []).slice(0, 3), [expenses])

  const dates = useMemo(
    () => (trip ? formatTripDates(trip.start_date, trip.end_date, i18n.language) : null),
    [trip, i18n.language],
  )

  function goGroup() {
    router.push({ pathname: '/trips/[id]/group', params: { id: tripId } })
  }
  function goTab(name: 'timeline' | 'expenses' | 'pois') {
    // navigate (not push) is intentional: switch tabs in place instead of stacking tab routes.
    router.navigate({ pathname: `/trips/[id]/${name}`, params: { id: tripId } })
  }

  if (isLoading) {
    return <TripDashboardSkeleton />
  }

  if (isError || !trip) {
    return (
      <Screen title={t('trip.notFound')} showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('trip.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  const currency = trip.currency
  const myBalance =
    (balances ?? []).find((balance) => balance.user_id === userId)?.balance_cents ?? 0
  const settled = myBalance === 0
  const positive = myBalance > 0

  const balanceTone = settled
    ? theme.colors.foreground
    : positive
      ? theme.colors.success
      : theme.colors.destructive
  const balanceSub = settled
    ? t('trip.settledSub')
    : positive
      ? t('trip.owedSub', { names: debtorNames.join(', ') })
      : t('trip.oweSub')

  const nextStatus = nextEvent ? eventStatus(nextEvent.starts_at, nextEvent.ends_at, now) : null

  function payerName(memberId: string | null): string {
    return (memberId && nameById.get(memberId)) || t('common.member')
  }

  const isOwner = trip.owner_id === userId

  function confirmRegenerate() {
    Alert.alert(
      'Régénérer le code d’invitation',
      'Le code actuel cessera de fonctionner. Les personnes déjà inscrites conservent leur accès.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('group.regenerate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerate.mutateAsync()
            } catch (error) {
              Alert.alert(
                'Régénération impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  function confirmDelete() {
    Alert.alert(
      t('group.deleteTrip'),
      'Cette action supprime définitivement le voyage et toutes ses données.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTripMutation.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Suppression impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  function confirmLeave() {
    Alert.alert(
      t('group.leaveTrip'),
      'Tu ne verras plus ce voyage ni ses dépenses. Les dépenses passées que tu as payées ou que tu dois restent comptabilisées.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveTripMutation.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Impossible de quitter',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  // Full-bleed cover: its corners trace the device's screen radius exactly (no inset to
  // subtract). Falls back to the xl token when the radius is undetectable.
  const coverRadius = ScreenCornerRadius > 0 ? ScreenCornerRadius : theme.radius.xl

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Inset cover hero */}
        <View>
          <CityImage
            uri={trip.cover_photo_url}
            seed={trip.destination ?? trip.title}
            height={284}
            radius={coverRadius}
            corners="all"
            scrim={false}
          >
            <LinearGradient
              colors={COVER_FADE_COLORS}
              locations={COVER_FADE_LOCATIONS}
              style={styles.fade}
              pointerEvents="none"
            />
            <View style={styles.coverTop}>
              <CoverButton
                icon="chevron-back"
                label={t('common.back')}
                onPress={() => router.back()}
              />
              <CoverButton
                icon="ellipsis-horizontal"
                label={t('trip.manage')}
                onPress={() => setActionsOpen(true)}
              />
            </View>
            <View style={styles.coverBottom}>
              <View style={styles.coverInfo}>
                <Text style={styles.coverTitle} numberOfLines={2}>
                  {trip.title}
                </Text>
                {trip.destination ? (
                  <View style={styles.coverRow}>
                    <Ionicons name="location" size={14} color="#FFFFFF" />
                    <Text style={styles.coverMeta} numberOfLines={1}>
                      {trip.destination}
                    </Text>
                  </View>
                ) : null}
                {dates ? (
                  <View style={styles.coverRow}>
                    <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.coverMeta}>{dates}</Text>
                  </View>
                ) : null}
              </View>
              {avatarMembers.length > 0 ? (
                <Pressable
                  onPress={goGroup}
                  accessibilityRole="button"
                  accessibilityLabel={t('trip.manage')}
                  hitSlop={6}
                >
                  <AvatarStack members={avatarMembers} size={32} />
                </Pressable>
              ) : null}
            </View>
          </CityImage>
        </View>

        <View style={styles.content}>
          {/* Balance hero */}
          <Animated.View entering={enter(0)}>
            <Card>
              <View style={styles.balanceRow}>
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceLabel}>
                    {settled ? t('trip.settled') : positive ? t('trip.owed') : t('trip.owe')}
                  </Text>
                  <Text style={[styles.balanceAmount, { color: balanceTone }]}>
                    {formatAmount(Math.abs(myBalance), currency)}
                  </Text>
                  <Text style={styles.balanceSub}>{balanceSub}</Text>
                </View>
                <Surface
                  width={48}
                  height={48}
                  radius={theme.radius.md}
                  borderWidth={0}
                  color={withAlpha(settled ? theme.colors.success : theme.colors.primary, 0.12)}
                  style={styles.balanceIcon}
                >
                  <Ionicons
                    name={settled ? 'checkmark-done' : 'git-compare-outline'}
                    size={24}
                    color={settled ? theme.colors.success : theme.colors.primary}
                  />
                </Surface>
              </View>
              <View style={styles.balanceButton}>
                <Button
                  label={settled ? t('trip.viewBalances') : t('trip.settle')}
                  icon="git-compare-outline"
                  variant={settled ? 'secondary' : 'primary'}
                  onPress={goGroup}
                />
              </View>
            </Card>
          </Animated.View>

          {/* Quick actions (Zo lives in the floating bar now) */}
          <Animated.View style={styles.quickActions} entering={enter(1)}>
            <QuickAction
              icon="add-circle"
              label={t('trip.expense')}
              onPress={() =>
                router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
              }
            />
            <QuickAction
              icon="map"
              label={t('trip.map')}
              onPress={() => router.push({ pathname: '/trips/[id]/map', params: { id: tripId } })}
            />
            <QuickAction
              icon="navigate"
              label={t('trip.ar')}
              onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
            />
            <QuickAction
              icon="document-text"
              label={t('trip.documents')}
              onPress={() =>
                router.push({ pathname: '/trips/[id]/documents', params: { id: tripId } })
              }
            />
          </Animated.View>

          {/* Destination weather */}
          {weather && weather.days.length > 0 ? (
            <Animated.View entering={enter(2)}>
              <WeatherCard weather={weather} />
            </Animated.View>
          ) : null}

          {/* Next event */}
          {nextEvent && nextStatus?.kind === 'upcoming' ? (
            <Animated.View entering={enter(2)}>
              <SectionTitle action={t('tabs.timeline')} onAction={() => goTab('timeline')}>
                {t('trip.upcoming')}
              </SectionTitle>
              <View style={styles.blockBody}>
                <Card onPress={() => goTab('timeline')}>
                  <View style={styles.eventRow}>
                    <Surface
                      width={44}
                      height={44}
                      radius={theme.radius.md}
                      borderWidth={0}
                      color={withAlpha(theme.colors.primary, 0.12)}
                      style={styles.eventIcon}
                    >
                      <Ionicons
                        name={eventTypeIcon(nextEvent.type)}
                        size={22}
                        color={theme.colors.primary}
                      />
                    </Surface>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {nextEvent.title}
                      </Text>
                      {nextEvent.notes ? (
                        <Text style={styles.eventNotes} numberOfLines={1}>
                          {nextEvent.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Badge
                      label={formatCountdown(nextStatus, t)}
                      tone="primary"
                      icon="time-outline"
                    />
                  </View>
                </Card>
              </View>
            </Animated.View>
          ) : null}

          {/* Recent expenses */}
          {recent.length > 0 ? (
            <Animated.View entering={enter(3)}>
              <SectionTitle action={t('trip.viewAll')} onAction={() => goTab('expenses')}>
                {t('trip.recent')}
              </SectionTitle>
              <View style={styles.recentBody}>
                {recent.map((expense, index) => (
                  <Pressable
                    key={expense.id}
                    onPress={() => {
                      haptics.light()
                      router.push({
                        pathname: '/trips/[id]/expenses/[expenseId]',
                        params: { id: tripId, expenseId: expense.id },
                      })
                    }}
                    style={({ pressed }) => [
                      styles.expenseRow,
                      index === recent.length - 1 && styles.expenseRowLast,
                      pressed && styles.expenseRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${expense.description}, ${formatAmount(expense.amount_cents, expense.currency)}`}
                  >
                    <Surface
                      width={40}
                      height={40}
                      radius={theme.radius.md}
                      borderWidth={0}
                      color={withAlpha(theme.colors.muted, 0.12)}
                      style={styles.expenseIcon}
                    >
                      <Ionicons
                        name={CATEGORY_ICON[expense.category as ExpenseCategory] ?? 'pricetag'}
                        size={19}
                        color={theme.colors.muted}
                      />
                    </Surface>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseDescription} numberOfLines={1}>
                        {expense.description}
                      </Text>
                      <Text style={styles.expensePaidBy}>
                        {t('trip.paidBy', { name: payerName(expense.paid_by) })}
                      </Text>
                    </View>
                    <Text style={styles.expenseAmount}>
                      {formatAmount(expense.amount_cents, expense.currency)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      <BottomSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={t('trip.manage')}
      >
        <View style={styles.sheetActions}>
          {isOwner ? (
            <>
              <TripActionRow
                icon="create-outline"
                label={t('trip.editTrip')}
                onPress={() => {
                  setActionsOpen(false)
                  router.push({ pathname: '/trips/[id]/edit', params: { id: tripId } })
                }}
              />
              <TripActionRow
                icon="refresh-outline"
                label={t('trip.regenerateCode')}
                onPress={() => {
                  setActionsOpen(false)
                  confirmRegenerate()
                }}
              />
              <TripActionRow
                icon="trash-outline"
                label={t('group.deleteTrip')}
                tone="destructive"
                onPress={() => {
                  setActionsOpen(false)
                  confirmDelete()
                }}
              />
            </>
          ) : (
            <TripActionRow
              icon="exit-outline"
              label={t('group.leaveTrip')}
              tone="destructive"
              onPress={() => {
                setActionsOpen(false)
                confirmLeave()
              }}
            />
          )}
        </View>
      </BottomSheet>
    </View>
  )
}

// Loading placeholder shaped like the dashboard: a full-bleed cover block, then the balance
// card, quick actions and a few recent rows. The cover stays static (mirrors the real hero);
// the content blocks fade in staggered to match the loaded screen.
function TripDashboardSkeleton() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.container}>
      <View style={styles.skeletonCover}>
        <Skeleton width="100%" height={284} radius={theme.radius.xl} />
      </View>
      <View style={styles.content}>
        <Animated.View entering={enter(0)}>
          <Skeleton width="100%" height={148} radius={theme.radius.lg} />
        </Animated.View>
        <Animated.View style={styles.quickActions} entering={enter(1)}>
          <Skeleton width="100%" height={76} radius={theme.radius.lg} />
          <Skeleton width="100%" height={76} radius={theme.radius.lg} />
          <Skeleton width="100%" height={76} radius={theme.radius.lg} />
        </Animated.View>
        <Animated.View style={styles.skeletonSection} entering={enter(2)}>
          <Skeleton width={140} height={18} radius={theme.radius.sm} />
          <Skeleton width="100%" height={56} radius={theme.radius.md} />
          <Skeleton width="100%" height={56} radius={theme.radius.md} />
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sheetActions: {
    gap: theme.gap(1),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
  },
  actionRowPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  scroll: {
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  coverTop: {
    position: 'absolute',
    top: rt.insets.top + theme.gap(2),
    left: theme.gap(6),
    right: theme.gap(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverButton: {
    width: 40,
    height: 40,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  coverButtonPressed: {
    opacity: 0.8,
  },
  coverBottom: {
    position: 'absolute',
    left: theme.gap(6),
    right: theme.gap(6),
    bottom: theme.gap(6),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  coverInfo: {
    flexShrink: 1,
    gap: theme.gap(1),
  },
  coverTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xxl,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.25),
  },
  coverMeta: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  content: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(4),
    gap: theme.gap(4),
  },
  skeletonCover: {
    paddingTop: rt.insets.top,
  },
  skeletonSection: {
    gap: theme.gap(2.5),
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
  },
  balanceInfo: {
    flexShrink: 1,
  },
  balanceLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  balanceAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xxl,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  balanceSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 3,
  },
  balanceIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  balanceButton: {
    marginTop: theme.gap(3.5),
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.gap(2.5),
  },
  blockBody: {
    marginTop: theme.gap(2.5),
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  eventIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  eventNotes: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  recentBody: {
    marginTop: theme.gap(1),
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  expenseRowLast: {
    borderBottomWidth: 0,
  },
  expenseRowPressed: {
    opacity: 0.6,
  },
  expenseIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  expenseInfo: {
    flex: 1,
    minWidth: 0,
  },
  expenseDescription: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  expensePaidBy: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 3,
  },
  expenseAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
}))
