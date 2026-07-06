import { FlashList } from '@shopify/flash-list'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { EmptyState, ErrorState, ListRow, Spinner } from '@/components/ui'
import { type ImportProposal, useProposals } from '@/features/inbox'
import { paramString } from '@/lib/routing'

// Settled proposals (validated/rejected/expired) are filtered out - there is nothing left to do
// with them here. Only what still needs attention (or recently failed) shows up.
const VISIBLE_STATUSES = ['pending', 'parsing', 'failed']

// A pending proposal with no usable events reads the same as a failed one: nothing to review.
function hasNoEvents(proposal: ImportProposal): boolean {
  return !proposal.events || proposal.events.length === 0
}

export default function InboxScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data, isLoading, isError, refetch } = useProposals(tripId)

  const proposals = (data ?? []).filter((p) => VISIBLE_STATUSES.includes(p.status))

  function openProposal(proposal: ImportProposal) {
    router.push({
      pathname: '/trips/[id]/inbox/[proposalId]',
      params: { id: tripId, proposalId: proposal.id },
    })
  }

  if (isLoading) {
    return (
      <Screen title={t('inbox.title')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title={t('inbox.title')} showBack>
        <ErrorState
          title={t('errors.title')}
          body={t('errors.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    )
  }

  if (proposals.length === 0) {
    return (
      <Screen title={t('inbox.title')} showBack>
        <View style={styles.center}>
          <EmptyState
            icon="mail-open-outline"
            title={t('inbox.emptyTitle')}
            body={t('inbox.emptyBody')}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('inbox.title')} showBack>
      <FlashList
        data={proposals}
        keyExtractor={(proposal) => proposal.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const reviewable = item.status === 'pending' && !hasNoEvents(item)
          return (
            <ListRow
              icon={
                item.status === 'parsing'
                  ? 'hourglass-outline'
                  : reviewable
                    ? 'mail-unread-outline'
                    : 'alert-circle-outline'
              }
              iconColor={
                item.status === 'parsing'
                  ? theme.colors.muted
                  : reviewable
                    ? theme.colors.primary
                    : theme.colors.destructive
              }
              title={item.subject || t('inbox.noSubject')}
              subtitle={
                item.status === 'parsing'
                  ? t('inbox.parsing')
                  : !reviewable
                    ? t('inbox.noEvents')
                    : t('inbox.receivedFrom', { sender: item.sender_email ?? '' })
              }
              detail={
                reviewable ? t('inbox.eventCount', { count: item.events?.length ?? 0 }) : undefined
              }
              right={item.status === 'parsing' ? <ActivityIndicator size="small" /> : undefined}
              onPress={reviewable ? () => openProposal(item) : undefined}
              last={index === proposals.length - 1}
            />
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(6),
  },
}))
