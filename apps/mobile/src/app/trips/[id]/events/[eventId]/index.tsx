import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import {
  formatFileSize,
  getDocumentUrl,
  type TripDocument,
  useDeleteDocument,
  useEventDocuments,
  useUploadDocument,
} from '@/features/media'
import { eventStatus, formatCountdown, useDeleteEvent, useEvent } from '@/features/timeline'
import { paramString } from '@/lib/routing'

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string; eventId: string }>()
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
    Alert.alert('Delete event', 'This permanently removes the event and detaches its documents.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent.mutateAsync(eventId)
            router.back()
          } catch (error) {
            Alert.alert(
              'Could not delete',
              error instanceof Error ? error.message : 'Please try again.',
            )
          }
        },
      },
    ])
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
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  async function openDocument(doc: TripDocument) {
    try {
      const url = await getDocumentUrl(doc.storage_path)
      await Linking.openURL(url)
    } catch (error) {
      Alert.alert('Could not open', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  function confirmDelete(doc: TripDocument) {
    Alert.alert('Delete document', doc.name ?? 'This document', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(doc)
          } catch (error) {
            Alert.alert(
              'Could not delete',
              error instanceof Error ? error.message : 'Please try again.',
            )
          }
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  if (!event) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>Event not found.</Text>
        </View>
      </Screen>
    )
  }

  const status = eventStatus(event.starts_at, event.ends_at)

  return (
    <Screen title={event.title} scroll>
      <View style={styles.card}>
        {event.starts_at ? (
          <Text style={styles.body}>{new Date(event.starts_at).toLocaleString()}</Text>
        ) : null}
        {event.ends_at ? (
          <Text style={styles.muted}>→ {new Date(event.ends_at).toLocaleString()}</Text>
        ) : null}
        {status.kind === 'upcoming' ? (
          <Text style={styles.badgePrimary}>{formatCountdown(status)}</Text>
        ) : status.kind === 'in_progress' ? (
          <Text style={styles.badgeSuccess}>In progress</Text>
        ) : status.kind === 'completed' ? (
          <Text style={styles.muted}>Completed</Text>
        ) : null}
        {event.notes ? <Text style={styles.notes}>{event.notes}</Text> : null}
        {(() => {
          const gate = event.gate_location as {
            label?: string
            lat?: number
            lng?: number
          } | null
          if (!gate || typeof gate.lat !== 'number' || typeof gate.lng !== 'number') {
            return null
          }
          return (
            <View style={styles.gateRow}>
              <Ionicons name="airplane" size={18} color={theme.colors.primary} />
              <Text style={styles.body}>{gate.label || 'Gate'}</Text>
            </View>
          )
        })()}
      </View>

      <View style={styles.actions}>
        <Link
          href={{
            pathname: '/trips/[id]/events/[eventId]/edit',
            params: { id: tripId, eventId },
          }}
          style={styles.link}
        >
          Edit
        </Link>
        <Pressable
          onPress={confirmDeleteEvent}
          disabled={deleteEvent.isPending}
          accessibilityRole="button"
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Documents</Text>
        <Pressable
          onPress={addDocument}
          disabled={upload.isPending}
          accessibilityRole="button"
          accessibilityLabel="Add document"
          hitSlop={8}
        >
          <Text style={styles.link}>{upload.isPending ? 'Uploading…' : 'Add'}</Text>
        </Pressable>
      </View>

      {!documents || documents.length === 0 ? (
        <Text style={styles.muted}>No documents yet.</Text>
      ) : (
        documents.map((doc) => (
          <Pressable
            key={doc.id}
            style={styles.docRow}
            onPress={() => openDocument(doc)}
            accessibilityRole="button"
          >
            <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
            <View style={styles.docInfo}>
              <Text style={styles.body} numberOfLines={1}>
                {doc.name ?? 'Document'}
              </Text>
              <Text style={styles.muted}>{formatFileSize(doc.size_bytes)}</Text>
            </View>
            <Pressable
              onPress={() => confirmDelete(doc)}
              accessibilityRole="button"
              accessibilityLabel="Delete document"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
            </Pressable>
          </Pressable>
        ))
      )}

      <Button
        label={upload.isPending ? 'Uploading…' : 'Add a document'}
        onPress={addDocument}
        disabled={upload.isPending}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: theme.gap(1),
    padding: theme.gap(4),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  muted: {
    color: theme.colors.muted,
  },
  notes: {
    paddingTop: theme.gap(2),
    color: theme.colors.foreground,
  },
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingTop: theme.gap(2),
  },
  badgePrimary: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  badgeSuccess: {
    fontWeight: '700',
    color: theme.colors.success,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.gap(2),
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  docInfo: {
    flex: 1,
    gap: theme.gap(1),
  },
  actions: {
    flexDirection: 'row',
    gap: theme.gap(4),
    paddingTop: theme.gap(1),
  },
  deleteText: {
    color: theme.colors.destructive,
    fontWeight: '600',
  },
}))
