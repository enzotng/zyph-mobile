import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

type Props = {
  width: number
  height: number
  delta: number
  pitch: number
}

export function ArArrow({ width, height, delta, pitch }: Props) {
  const { theme } = useUnistyles()
  const behind = Math.abs(delta) > 110
  const tiltFactor = Math.max(-0.4, Math.min(0.4, pitch))
  const scaleY = 1 - Math.abs(tiltFactor) * 0.45

  return (
    <View pointerEvents="none" style={[styles.root, { width, height }]}>
      <View style={styles.center}>
        {behind ? (
          <View style={styles.turnAround}>
            <Ionicons name="refresh" size={26} color="#FFD15A" />
            <Text style={styles.turnAroundText}>Turn around</Text>
          </View>
        ) : (
          <View
            style={[
              styles.arrowWrap,
              {
                transform: [{ rotate: `${delta}deg` }, { scaleY }],
              },
            ]}
          >
            <Ionicons name="navigate" size={96} color={theme.colors.primary} />
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create(() => ({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  turnAround: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  turnAroundText: {
    color: '#FFD15A',
    fontSize: 16,
    fontWeight: '700',
  },
}))
