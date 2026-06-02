import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  Amount,
  Avatar,
  AvatarStack,
  Badge,
  BottomSheet,
  Card,
  Chip,
  EmptyState,
  ListRow,
  MemberChip,
  QuickAction,
  SectionTitle,
  Segmented,
  Spinner,
  Squircle,
} from '@/components/ui'
import { setAppLanguage } from '@/lib/i18n'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/preferences'

const MEMBERS = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bruno' },
  { id: '3', name: 'Chloé' },
  { id: '4', name: 'David' },
  { id: '5', name: 'Emma' },
  { id: '6', name: 'Farid' },
]

const CATEGORIES = ['Transport', 'Hébergement', 'Repas', 'Activités']

// Dev-only gallery to preview the design-system primitives on device (light/dark + i18n).
export default function UiKitScreen() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference())
  const [category, setCategory] = useState('Transport')
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['1'])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tuneRadius, setTuneRadius] = useState(32)
  const [tuneSmoothing, setTuneSmoothing] = useState(8)

  function selectTheme(next: string) {
    setTheme(next as ThemePreference)
    setThemePreference(next as ThemePreference)
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  // Dev-only screen: inert in production builds even if the route is reachable.
  if (!__DEV__) {
    return null
  }

  return (
    <Screen title="UI kit" scroll>
      <SectionTitle>Appearance</SectionTitle>
      <Segmented
        options={[
          { label: 'System', value: 'system' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ]}
        value={theme}
        onChange={selectTheme}
      />

      <SectionTitle>Squircle tuner</SectionTitle>
      <Squircle radius={tuneRadius} smoothing={tuneSmoothing} style={styles.tuneBox}>
        <Text style={styles.cardText}>
          radius {tuneRadius} - smoothing {tuneSmoothing}
        </Text>
      </Squircle>
      <Text style={styles.muted}>Radius</Text>
      <Segmented
        options={[
          { label: '16', value: '16' },
          { label: '24', value: '24' },
          { label: '32', value: '32' },
          { label: '40', value: '40' },
        ]}
        value={String(tuneRadius)}
        onChange={(value) => setTuneRadius(Number(value))}
      />
      <Text style={styles.muted}>Smoothing</Text>
      <Segmented
        options={[
          { label: '3', value: '3' },
          { label: '5', value: '5' },
          { label: '8', value: '8' },
          { label: '12', value: '12' },
        ]}
        value={String(tuneSmoothing)}
        onChange={(value) => setTuneSmoothing(Number(value))}
      />

      <SectionTitle>Language (i18n)</SectionTitle>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>{t('trips.title')}</Text>
          <Text style={styles.muted}>{t('expenses.settleUp')}</Text>
        </View>
        <View style={styles.spacer} />
        <Segmented
          options={[
            { label: 'English', value: 'en' },
            { label: 'Français', value: 'fr' },
          ]}
          value={i18n.language}
          onChange={(lang) => setAppLanguage(lang as 'en' | 'fr')}
        />
      </Card>

      <SectionTitle>Buttons</SectionTitle>
      <Button label="Primary" />
      <Button label="Secondary" variant="secondary" />
      <Button label="Destructive" variant="destructive" icon="trash" />
      <Button label="Ghost" variant="ghost" />
      <View style={styles.row}>
        <Button label="Small" size="sm" block={false} />
        <Button label="Inline" variant="secondary" block={false} />
      </View>

      <SectionTitle>Inputs</SectionTitle>
      <TextField label="Trip name" placeholder="Weekend in Lisbon" />
      <TextField label="Email" placeholder="you@example.com" error="Enter a valid email" />

      <SectionTitle>Cards</SectionTitle>
      <Card>
        <Text style={styles.cardText}>A flat, bordered card.</Text>
      </Card>
      <Card onPress={() => setSheetOpen(true)}>
        <Text style={styles.cardText}>Tap me - opens a bottom sheet.</Text>
      </Card>

      <SectionTitle>Chips</SectionTitle>
      <View style={styles.wrap}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <View style={styles.wrap}>
        {MEMBERS.map((m) => (
          <MemberChip
            key={m.id}
            name={m.name}
            selected={selectedMembers.includes(m.id)}
            onPress={() => toggleMember(m.id)}
          />
        ))}
      </View>

      <SectionTitle>Badges</SectionTitle>
      <View style={styles.wrap}>
        <Badge label="Primary" tone="primary" />
        <Badge label="Success" tone="success" />
        <Badge label="Warning" tone="warning" />
        <Badge label="Destructive" tone="destructive" />
        <Badge label="Accent" tone="accent" />
        <Badge label="Muted" tone="muted" />
        <Badge label="Solid" tone="primary" solid />
      </View>

      <SectionTitle>Avatars</SectionTitle>
      <View style={styles.row}>
        <Avatar name="Alice" />
        <Avatar name="Bruno" size={48} />
        <AvatarStack members={MEMBERS} />
      </View>

      <SectionTitle>Amounts</SectionTitle>
      <View style={styles.wrap}>
        <Amount cents={1250} signed />
        <Amount cents={-840} signed />
        <Amount cents={0} />
        <Amount cents={4200} neutral size={20} />
      </View>

      <SectionTitle>List rows</SectionTitle>
      <Card padding={0} style={styles.listCard}>
        <ListRow
          icon="airplane"
          title="Flight to Lisbon"
          subtitle="Terminal 2 - Gate 14"
          detail="09:40"
        />
        <ListRow
          icon="card"
          iconColor="#10B981"
          title="Dinner"
          subtitle="Split 4 ways"
          onPress={() => undefined}
        />
        <ListRow icon="trash" title="Delete trip" danger last onPress={() => undefined} />
      </Card>

      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.row}>
        <QuickAction icon="add" label="Add expense" onPress={() => undefined} />
        <QuickAction icon="people" label="Invite" onPress={() => undefined} />
        <QuickAction icon="navigate" label="Wayfinder" onPress={() => undefined} />
      </View>

      <SectionTitle>Empty state</SectionTitle>
      <Card padding={0} style={styles.emptyCard}>
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          body="Create your first trip to get started."
          cta="Create a trip"
          onCta={() => setSheetOpen(true)}
        />
      </Card>

      <SectionTitle>Spinner</SectionTitle>
      <Card padding={0} style={styles.spinnerCard}>
        <Spinner label="Loading…" />
      </Card>

      <SectionTitle>Brand mark</SectionTitle>
      <View style={styles.row}>
        <ZyphMark size={40} />
        <ZyphMark size={56} />
      </View>

      <View style={styles.spacer} />

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Bottom sheet">
        <Text style={styles.cardText}>
          This sheet slides up over a scrim. Tap outside to close.
        </Text>
        <View style={styles.spacer} />
        <Button label="Close" onPress={() => setSheetOpen(false)} />
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    flexWrap: 'wrap',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    flexWrap: 'wrap',
  },
  muted: {
    color: theme.colors.muted,
    fontWeight: '600',
  },
  cardText: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  },
  tuneBox: {
    height: 120,
    padding: theme.gap(4),
    justifyContent: 'center',
  },
  listCard: {
    paddingHorizontal: theme.gap(4),
  },
  emptyCard: {
    height: 260,
  },
  spinnerCard: {
    height: 120,
  },
  spacer: {
    height: theme.gap(3),
  },
}))
