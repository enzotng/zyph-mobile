import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import * as DocumentPicker from 'expo-document-picker'
import { useGlobalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
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

function formatDocDate(iso: string | null, locale: string): string {
  if (!iso) {
    return ''
  }
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function TripDocumentsScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()

  const { data: documents, isLoading, isError, refetch } = useTripDocuments(tripId)
  const upload = useUploadTripDocument(tripId)
  const del = useDeleteTripDocument(tripId)
  // The delete hook is shared across rows, so track which document is deleting to scope the row's
  // spinner + disabled trash to that one row instead of every row.
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
          setDeletingId(doc.id)
          try {
            await del.mutateAsync(doc)
          } catch (error) {
            Alert.alert(
              t('documents.deleteError'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          } finally {
            setDeletingId(null)
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

  const uploadingHeader = upload.isPending ? (
    <View style={styles.statusRow}>
      <Spinner label={t('documents.uploading')} />
    </View>
  ) : null

  return (
    <Screen title={t('documents.title')} showBack right={addButton}>
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
        <>
          {uploadingHeader}
          <EmptyState
            icon="document-text-outline"
            title={t('documents.emptyTitle')}
            body={t('documents.emptyBody')}
            cta={t('documents.add')}
            onCta={addDocument}
          />
        </>
      ) : (
        <FlashList
          data={documents}
          keyExtractor={(doc) => doc.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={uploadingHeader}
          renderItem={({ item: doc }) => {
            const deleting = deletingId === doc.id
            return (
              <Pressable
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
                    {[formatFileSize(doc.size_bytes), formatDocDate(doc.created_at, i18n.language)]
                      .filter(Boolean)
                      .join(' - ')}
                  </Text>
                </View>
                {deleting ? (
                  <View style={styles.trash}>
                    <ActivityIndicator size="small" color={theme.colors.muted} />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => confirmDelete(doc)}
                    disabled={deletingId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t('documents.delete')}
                    hitSlop={8}
                    style={styles.trash}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.muted} />
                  </Pressable>
                )}
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
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
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    marginBottom: theme.gap(2),
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
