import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useGlobalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { EmptyState, ErrorState, Spinner, Surface } from '@/components/ui'
import {
  formatFileSize,
  getDocumentUrl,
  type TripDocument,
  useDeleteTripDocument,
  useTripDocuments,
  useUploadTripDocument,
} from '@/features/media'
import { withAlpha } from '@/lib/color'
import { paramString } from '@/lib/routing'

function formatDocDate(iso: string | null): string {
  if (!iso) {
    return ''
  }
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function TripDocumentsScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  const { data: documents, isLoading, isError, refetch } = useTripDocuments(tripId)
  const upload = useUploadTripDocument(tripId)
  const del = useDeleteTripDocument(tripId)

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
        eventId: null,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
        sizeBytes: asset.size ?? 0,
      })
    } catch (error) {
      Alert.alert(
        t('documents.uploadError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  async function openDocument(doc: TripDocument) {
    try {
      const url = await getDocumentUrl(doc.storage_path)
      // In-app browser sheet (native PDF viewer + share on iOS), never leaves the app.
      await WebBrowser.openBrowserAsync(url)
    } catch (error) {
      Alert.alert(
        t('documents.openError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  function confirmDelete(doc: TripDocument) {
    Alert.alert(t('documents.deleteTitle'), doc.name ?? t('documents.fallbackName'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(doc)
          } catch (error) {
            Alert.alert(
              t('documents.deleteError'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  const addButton = (
    <Pressable
      onPress={addDocument}
      accessibilityRole="button"
      accessibilityLabel={t('documents.add')}
      hitSlop={8}
    >
      <Ionicons name="add" size={26} color={theme.colors.primary} />
    </Pressable>
  )

  return (
    <Screen title={t('documents.title')} showBack right={addButton} scroll>
      {upload.isPending ? (
        <View style={styles.statusRow}>
          <Spinner label={t('documents.uploading')} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : isError ? (
        <ErrorState
          title={t('errors.title')}
          body={t('errors.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={t('documents.emptyTitle')}
          body={t('documents.emptyBody')}
          cta={t('documents.add')}
          onCta={addDocument}
        />
      ) : (
        <View style={styles.list}>
          {documents.map((doc) => (
            <Pressable
              key={doc.id}
              onPress={() => openDocument(doc)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Surface
                width={40}
                height={40}
                radius={theme.radius.md}
                color={withAlpha(theme.colors.destructive, 0.12)}
                borderWidth={0}
                style={styles.icon}
              >
                <Ionicons name="document-text" size={20} color={theme.colors.destructive} />
              </Surface>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {doc.name ?? t('documents.fallbackName')}
                </Text>
                <Text style={styles.meta}>
                  {[formatFileSize(doc.size_bytes), formatDocDate(doc.created_at)]
                    .filter(Boolean)
                    .join(' - ')}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(doc)}
                accessibilityRole="button"
                accessibilityLabel={t('documents.delete')}
                hitSlop={8}
                style={styles.trash}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.muted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  statusRow: {
    alignItems: 'center',
    paddingVertical: theme.gap(2),
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.gap(16),
  },
  list: {
    gap: theme.gap(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  meta: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  trash: {
    padding: theme.gap(1),
  },
}))
