import { Ionicons } from '@expo/vector-icons'
import TextRecognition from '@react-native-ml-kit/text-recognition'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { type ParsedReceiptItems, parseReceiptItems } from '@/features/expenses'

import { Button } from './button'

type ReceiptScannerProps = {
  visible: boolean
  onClose: () => void
  onResult: (parsed: ParsedReceiptItems) => void
}

export function ReceiptScanner({ visible, onClose, onResult }: ReceiptScannerProps) {
  const { theme } = useUnistyles()
  const cameraRef = useRef<CameraView | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [processing, setProcessing] = useState(false)

  async function capture() {
    const camera = cameraRef.current
    if (!camera || processing) {
      return
    }
    setProcessing(true)
    try {
      const picture = await camera.takePictureAsync({ quality: 0.7, skipProcessing: true })
      if (!picture?.uri) {
        throw new Error('No picture URI returned')
      }
      const result = await TextRecognition.recognize(picture.uri)
      const parsed = parseReceiptItems(result.text)
      onResult(parsed)
    } catch {
      Alert.alert('Scan failed', 'Could not read this receipt. Try again with better lighting.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.message}>ZYPH needs access to your camera to scan receipts.</Text>
            <Button label="Grant camera access" onPress={() => void requestPermission()} />
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.topBar}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </Pressable>
              <Text style={styles.hint}>Frame the receipt and tap the shutter.</Text>
            </View>
            <View style={styles.bottomBar}>
              {processing ? (
                <View style={styles.processing}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.processingText}>Reading receipt…</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => void capture()}
                  accessibilityRole="button"
                  accessibilityLabel="Capture receipt"
                  style={styles.shutter}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(4),
    padding: theme.gap(6),
    backgroundColor: theme.colors.background,
  },
  message: {
    textAlign: 'center',
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  },
  cancel: {
    color: theme.colors.muted,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: rt.insets.top + theme.gap(2),
    left: theme.gap(4),
    right: theme.gap(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hint: {
    flex: 1,
    color: '#fff',
    fontSize: theme.fontSize.sm,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: rt.insets.bottom + theme.gap(6),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  processing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingHorizontal: theme.gap(4),
    paddingVertical: theme.gap(3),
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  processingText: {
    color: '#fff',
    fontWeight: '600',
  },
}))
