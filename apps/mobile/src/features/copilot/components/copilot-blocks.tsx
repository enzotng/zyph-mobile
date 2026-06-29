import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Spinner, Surface } from '@/components/ui'

import type { Block, Chip } from '../schemas'
import { CopilotWidget } from './copilot-widget'

export type ActionState = 'pending' | 'executing' | 'done' | 'cancelled'

function assertNever(value: never): never {
  throw new Error(`Unhandled block kind: ${JSON.stringify(value)}`)
}

type Props = {
  blocks: Block[]
  tripId: string
  messageId: string
  actionStateFor: (index: number) => ActionState
  onConfirm: (index: number, block: Extract<Block, { kind: 'action' }>) => void
  onCancel: (index: number) => void
  onChip: (chip: Chip) => void
  executePending: boolean
}

export function CopilotBlocks({
  blocks,
  tripId,
  messageId,
  actionStateFor,
  onConfirm,
  onCancel,
  onChip,
  executePending,
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  return (
    <View style={styles.root}>
      {blocks.map((block, index) => {
        const key = `${messageId}:${index}`

        switch (block.kind) {
          case 'text':
            return (
              <Surface
                key={key}
                radius={18}
                color={theme.colors.card}
                borderColor={theme.colors.border}
                borderWidth={1}
                style={styles.bubble}
              >
                <Text style={styles.bubbleText}>{block.text}</Text>
              </Surface>
            )

          case 'widget':
            return (
              <View key={key} style={styles.widgetRow}>
                <CopilotWidget type={block.source} tripId={tripId} />
              </View>
            )

          case 'action': {
            const state = actionStateFor(index)
            const actionBlock = block as Extract<Block, { kind: 'action' }>
            return (
              <Surface
                key={key}
                radius={18}
                color={theme.colors.card}
                borderColor={theme.colors.border}
                borderWidth={1}
                style={styles.bubble}
              >
                <Text style={styles.bubbleText}>{block.text}</Text>
                {state === 'pending' ? (
                  <View style={styles.actionButtons}>
                    <Button
                      label={t('copilot.confirm')}
                      size="sm"
                      block={false}
                      disabled={executePending}
                      onPress={() => onConfirm(index, actionBlock)}
                    />
                    <Button
                      label={t('common.cancel')}
                      variant="ghost"
                      size="sm"
                      block={false}
                      disabled={executePending}
                      onPress={() => onCancel(index)}
                    />
                  </View>
                ) : state === 'executing' ? (
                  <View style={styles.actionStatusRow}>
                    <Spinner label={t('copilot.actionRunning')} />
                  </View>
                ) : (
                  <Text style={styles.actionStatus}>
                    {state === 'done'
                      ? `✓ ${t('copilot.actionDone')}`
                      : t('copilot.actionCancelled')}
                  </Text>
                )}
              </Surface>
            )
          }

          case 'chips':
            return (
              <View key={key} style={styles.chipRow}>
                {block.chips.map((chip, chipIndex) => (
                  <Pressable
                    key={`${messageId}:${index}:${chipIndex}`}
                    style={({ pressed }) => [styles.chipPill, pressed && styles.chipPillPressed]}
                    onPress={() => onChip(chip)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipLabel}>{chip.label}</Text>
                  </Pressable>
                ))}
              </View>
            )

          case 'itinerary':
            // Itinerary rendering is handled by a dedicated screen; no inline bubble.
            return null

          default: {
            // Exhaustive check: if a new kind is added to Block, TypeScript will flag this.
            assertNever(block)
            return null
          }
        }
      })}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.gap(2),
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(3.5),
    borderTopLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  bubbleText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    marginTop: theme.gap(2.5),
  },
  actionStatus: {
    marginTop: theme.gap(2),
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  actionStatusRow: {
    marginTop: theme.gap(2),
  },
  widgetRow: {
    alignSelf: 'stretch',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    alignSelf: 'flex-start',
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipPillPressed: {
    opacity: 0.7,
  },
  chipLabel: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.sm,
  },
}))
