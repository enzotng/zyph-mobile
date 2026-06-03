import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { poiIconName } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { EmptyState, ListRow, SectionTitle, Spinner, Squircle } from '@/components/ui'
import { useTrip } from '@/features/trips'
import { useDeletePoi, usePois } from '@/features/wayfinder'
import { withAlpha } from '@/lib/color'
import { paramString } from '@/lib/routing'

export default function PoisScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { data: trip } = useTrip(tripId)
  const { data: pois, isLoading, isError } = usePois(tripId)
  const deletePoi = useDeletePoi(tripId)

  function confirmDelete(poiId: string, label: string) {
    Alert.alert('Supprimer le repère', `Retirer « ${label} » de ce voyage ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePoi.mutateAsync(poiId)
          } catch (error) {
            Alert.alert(
              'Suppression impossible',
              error instanceof Error ? error.message : 'Veuillez réessayer.',
            )
          }
        },
      },
    ])
  }

  function goAddPoi() {
    router.push({ pathname: '/trips/[id]/pois/new', params: { id: tripId } })
  }

  const addButton = (
    <Pressable
      onPress={goAddPoi}
      accessibilityRole="button"
      accessibilityLabel="Ajouter un repère"
      hitSlop={8}
    >
      <Ionicons name="add" size={26} color={theme.colors.foreground} />
    </Pressable>
  )

  const mapPreview = (
    <Pressable
      onPress={() => router.push({ pathname: '/trips/[id]/map', params: { id: tripId } })}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la carte"
    >
      <Squircle
        color={withAlpha(theme.colors.primary, 0.1)}
        borderWidth={0}
        radius={theme.radius.lg}
        style={styles.mapPreview}
      >
        <Ionicons name="map" size={32} color={theme.colors.primary} />
        <Text style={styles.mapCaption}>CARTE</Text>
      </Squircle>
    </Pressable>
  )

  const arHero = (
    <Pressable
      onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la vue AR"
    >
      <Squircle
        color={theme.colors.primary}
        borderWidth={0}
        radius={theme.radius.lg}
        style={styles.arHero}
      >
        <View style={styles.arIconTile}>
          <Ionicons name="navigate" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.arInfo}>
          <Text style={styles.arTitle}>Vue AR</Text>
          <Text style={styles.arSubtitle}>Une flèche vous guide vers vos repères</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </Squircle>
    </Pressable>
  )

  if (isLoading) {
    return (
      <Screen title={trip?.title} showBack scroll right={addButton}>
        {mapPreview}
        <View style={styles.heroSpacing}>{arHero}</View>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title={trip?.title} showBack scroll right={addButton}>
        {mapPreview}
        <View style={styles.heroSpacing}>{arHero}</View>
        <View style={styles.center}>
          <Text style={styles.muted}>Impossible de charger les repères.</Text>
        </View>
      </Screen>
    )
  }

  const waypoints = pois ?? []

  return (
    <Screen title={trip?.title} showBack scroll right={addButton}>
      {mapPreview}
      <View style={styles.heroSpacing}>{arHero}</View>

      <SectionTitle action="Ajouter" onAction={goAddPoi}>
        Lieux & membres
      </SectionTitle>

      {waypoints.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="location-outline"
            title="Aucun repère"
            body="Ajoutez des entrées, des toilettes ou tout autre point pour la carte et la navigation AR."
            cta="Ajouter un repère"
            onCta={goAddPoi}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {waypoints.map((item, index) => (
            <ListRow
              key={item.id}
              icon={poiIconName(item.icon)}
              iconColor={theme.colors.primary}
              title={item.label}
              subtitle="Point d'intérêt"
              last={index === waypoints.length - 1}
              accessibilityLabel={`Modifier ${item.label}`}
              onPress={() =>
                router.push({
                  pathname: '/trips/[id]/pois/[poiId]/edit',
                  params: { id: tripId, poiId: item.id },
                })
              }
              right={
                <Pressable
                  onPress={() => confirmDelete(item.id, item.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer ${item.label}`}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
                </Pressable>
              }
            />
          ))}
        </View>
      )}

      <View style={styles.spacer} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.gap(8),
  },
  mapPreview: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
  },
  mapCaption: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
    letterSpacing: 1.2,
    color: theme.colors.primary,
  },
  heroSpacing: {
    marginTop: theme.gap(3.5),
  },
  arHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    padding: theme.gap(4),
  },
  arIconTile: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  arInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.gap(0.5),
  },
  arTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: '#FFFFFF',
  },
  arSubtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  list: {
    marginTop: theme.gap(1),
  },
  emptyWrap: {
    marginTop: theme.gap(4),
  },
  muted: {
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
}))
