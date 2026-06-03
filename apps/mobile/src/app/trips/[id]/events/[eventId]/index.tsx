import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Badge, Card, SectionTitle, Spinner, Squircle } from '@/components/ui'
import {
  formatFileSize,
  getDocumentUrl,
  type TripDocument,
  useDeleteDocument,
  useEventDocuments,
  useUploadDocument,
} from '@/features/media'
import { eventStatus, formatCountdown, useDeleteEvent, useEvent } from '@/features/timeline'
import { withAlpha } from '@/lib/color'
import { paramString } from '@/lib/routing'

function formatEventDate(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  const date = new Date(iso)
  const day = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export default function EventDetailScreen() {
  const params = useGlobalSearchParams<{ id: string; eventId: string }>()
  const tripId = paramString(params.id)
  const eventId = paramString(params.eventId)
  const { theme } = useUnistyles()
  const router = useRouter()

  const { data: event, isLoading } = useEvent(eventId)
  const { data: documents } = useEventDocuments(eventId)
  const upload = useUploadDocument(eventId)
  const del = useDeleteDocument(eventId)
  const deleteEvent = useDeleteEvent(tripId)

  function confirmDeleteEvent() {
    Alert.alert(
      'Supprimer l’événement',
      "Cela supprime définitivement l'événement et détache ses documents.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent.mutateAsync(eventId)
              router.back()
            } catch (error) {
              Alert.alert(
                'Suppression impossible',
                error instanceof Error ? error.message : 'Veuillez réessayer.',
              )
            }
          },
        },
      ],
    )
  }

  async function addDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    })
    if (result.canceled) {
      return
    }
    const asset = result.assets[0]
    try {
      await upload.mutateAsync({
        tripId,
        eventId,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
        sizeBytes: asset.size ?? 0,
      })
    } catch (error) {
      Alert.alert(
        'Échec de l’envoi',
        error instanceof Error ? error.message : 'Veuillez réessayer.',
      )
    }
  }

  async function openDocument(doc: TripDocument) {
    try {
      const url = await getDocumentUrl(doc.storage_path)
      await Linking.openURL(url)
    } catch (error) {
      Alert.alert(
        'Ouverture impossible',
        error instanceof Error ? error.message : 'Veuillez réessayer.',
      )
    }
  }

  function confirmDelete(doc: TripDocument) {
    Alert.alert('Supprimer le document', doc.name ?? 'Ce document', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(doc)
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

  if (isLoading) {
    return (
      <Screen title="Événement" showBack>
        <View style={styles.center}>
          <Spinner label="Chargement…" />
        </View>
      </Screen>
    )
  }

  if (!event) {
    return (
      <Screen title="Événement" showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>Événement introuvable.</Text>
        </View>
      </Screen>
    )
  }

  const status = eventStatus(event.starts_at, event.ends_at)
  const dateLabel = formatEventDate(event.starts_at)
  const gate = event.gate_location as { label?: string; lat?: number; lng?: number } | null
  const hasGate = Boolean(gate && typeof gate.lat === 'number' && typeof gate.lng === 'number')

  return (
    <Screen
      title="Événement"
      showBack
      scroll
      right={
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/trips/[id]/events/[eventId]/edit',
              params: { id: tripId, eventId },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Modifier"
          hitSlop={8}
        >
          <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
        </Pressable>
      }
    >
      <Card>
        <View style={styles.headRow}>
          <Squircle
            width={46}
            height={46}
            radius={theme.radius.md}
            borderWidth={0}
            color={withAlpha(theme.colors.primary, 0.12)}
            style={styles.headTile}
          >
            <Ionicons name="calendar" size={23} color={theme.colors.primary} />
          </Squircle>
          <View style={styles.headInfo}>
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>
            {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.badges}>
          {status.kind === 'upcoming' ? (
            <Badge label={formatCountdown(status)} tone="primary" icon="time-outline" />
          ) : status.kind === 'in_progress' ? (
            <Badge label="En cours" tone="success" icon="ellipse" />
          ) : status.kind === 'completed' ? (
            <Badge label="Terminé" tone="muted" />
          ) : null}
          {hasGate ? (
            <Badge label={gate?.label || 'Lieu épinglé'} tone="muted" icon="location-outline" />
          ) : null}
        </View>
      </Card>

      {event.notes ? (
        <View>
          <SectionTitle>Notes</SectionTitle>
          <Text style={styles.notes}>{event.notes}</Text>
        </View>
      ) : null}

      <View>
        <SectionTitle
          action={upload.isPending ? 'Envoi…' : 'Ajouter'}
          onAction={upload.isPending ? undefined : addDocument}
        >
          Documents joints
        </SectionTitle>
        <View style={styles.docList}>
          {!documents || documents.length === 0 ? (
            <Text style={styles.muted}>Aucun document pour l’instant.</Text>
          ) : (
            documents.map((doc) => (
              <Pressable
                key={doc.id}
                style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}
                onPress={() => openDocument(doc)}
                accessibilityRole="button"
              >
                <Squircle
                  width={34}
                  height={34}
                  radius={theme.radius.sm}
                  borderWidth={0}
                  color={withAlpha(theme.colors.destructive, 0.12)}
                  style={styles.docTile}
                >
                  <Ionicons name="document-text" size={18} color={theme.colors.destructive} />
                </Squircle>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.name ?? 'Document'}
                  </Text>
                  <Text style={styles.muted}>{formatFileSize(doc.size_bytes)}</Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(doc)}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer le document"
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.muted} />
                </Pressable>
              </Pressable>
            ))
          )}
        </View>
      </View>

      <Button
        label="Voir en AR"
        variant="secondary"
        icon="navigate"
        onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
      />

      <Pressable
        onPress={confirmDeleteEvent}
        disabled={deleteEvent.isPending}
        accessibilityRole="button"
        style={styles.deleteWrap}
      >
        <Text style={styles.deleteText}>Supprimer l’événement</Text>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  headTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
  },
  headInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
  },
  date: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    marginTop: theme.gap(3.5),
  },
  notes: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    lineHeight: 22,
    color: theme.colors.foreground,
    marginTop: theme.gap(2),
  },
  docList: {
    gap: theme.gap(2),
    marginTop: theme.gap(2),
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    padding: theme.gap(2.5),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  docTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
  },
  docInfo: {
    flex: 1,
    minWidth: 0,
  },
  docName: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  pressed: {
    opacity: 0.85,
  },
  deleteWrap: {
    alignSelf: 'center',
    paddingVertical: theme.gap(1),
  },
  deleteText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.destructive,
  },
}))
