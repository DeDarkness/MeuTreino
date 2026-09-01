import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppShell, type AppSection } from '@/components/layout/app-shell';
import { useWorkoutApp } from '@/context/workout-app-context';
import { HistoryScreen } from '@/screens/history-screen';
import { SyncScreen } from '@/screens/sync-screen';
import { WorkoutsScreen } from '@/screens/workouts-screen';
import { colors, spacing, typography } from '@/theme/tokens';

export default function AppIndex() {
  const { ready, session, syncVisualState } = useWorkoutApp();
  const [section, setSection] = useState<AppSection>('workouts');

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Preparando seus treinos…</Text>
      </View>
    );
  }

  return (
    <AppShell
      section={section}
      onSectionChange={setSection}
      syncState={syncVisualState}
      userEmail={session?.user.email}
    >
      {section === 'workouts' ? <WorkoutsScreen /> : null}
      {section === 'history' ? <HistoryScreen /> : null}
      {section === 'sync' ? <SyncScreen /> : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
});
