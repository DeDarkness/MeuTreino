import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import {
  AdaptiveModal,
  AppButton,
  Card,
  EmptyState,
  IconButton,
  SectionHeader,
} from '@/components/ui/primitives';
import { useWorkoutApp } from '@/context/workout-app-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatDate, formatDuration } from '@/lib/workout-domain';
import { confirmDialog } from '@/services/confirm-dialog';
import { colors, radii, spacing, typography, webPointer } from '@/theme/tokens';
import type { HistoryItem } from '@/types/models';

export function HistoryScreen() {
  const { data, deleteHistoryItem } = useWorkoutApp();
  const { isPhone, cardColumns } = useResponsiveLayout();
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  const totals = useMemo(
    () => ({
      duration: data.history.reduce((value, item) => value + item.durationSeconds, 0),
      sets: data.history.reduce((value, item) => value + item.totalSets, 0),
      reps: data.history.reduce((value, item) => value + item.totalReps, 0),
    }),
    [data.history],
  );
  const cardBasis = cardColumns === 1 ? '100%' : cardColumns === 2 ? '48.5%' : '31.8%';

  const confirmDelete = async (item: HistoryItem) => {
    const confirmed = await confirmDialog({
      title: 'Excluir registro?',
      message: 'Este treino concluído será removido do histórico em todos os aparelhos sincronizados.',
      cancelLabel: 'Cancelar',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;

    deleteHistoryItem(item.id);
    setSelected(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: isPhone ? 30 : 44 }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>Histórico</Text>
            <Text style={styles.subtitle}>Acompanhe a consistência e revise o que foi realizado.</Text>
          </View>
        </View>

        {data.history.length > 0 ? (
          <View style={styles.summaryGrid}>
            <SummaryCard icon="calendar-check-outline" value={String(data.history.length)} label="treinos concluídos" />
            <SummaryCard icon="timer-outline" value={formatDuration(totals.duration)} label="tempo treinando" />
            <SummaryCard icon="check-circle-outline" value={String(totals.sets)} label="séries concluídas" />
            <SummaryCard icon="repeat" value={String(totals.reps)} label="repetições" />
          </View>
        ) : null}

        <SectionHeader title="Treinos concluídos" trailing={data.history.length ? `${data.history.length} registros` : undefined} />

        {data.history.length === 0 ? (
          <EmptyState
            icon="history"
            title="Seu histórico começa aqui"
            message="Ao finalizar um treino, o resumo com duração, séries e repetições aparecerá nesta tela."
          />
        ) : (
          <View style={styles.historyGrid}>
            {data.history.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                basis={cardBasis}
                onOpen={() => setSelected(item)}
                onDelete={() => confirmDelete(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <HistoryDetailModal item={selected} onClose={() => setSelected(null)} onDelete={confirmDelete} />
    </View>
  );
}

function SummaryCard({ icon, value, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; value: string; label: string }) {
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryIcon}><MaterialCommunityIcons name={icon} size={22} color={colors.accent} /></View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </Card>
  );
}

function HistoryCard({ item, basis, onOpen, onDelete }: { item: HistoryItem; basis: DimensionValue; onOpen: () => void; onDelete: () => void }) {
  return (
    <View style={[styles.historyCard, { flexBasis: basis }]}>
      <View style={styles.cardTop}>
        <View style={styles.completedIcon}><MaterialCommunityIcons name="check" size={24} color={colors.black} /></View>
        <IconButton icon="trash-can-outline" label={`Excluir registro de ${item.workoutName}`} danger onPress={onDelete} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir treino ${item.workoutName} de ${formatDate(item.endedAt)}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.historyOpen, pressed && styles.pressed, webPointer]}
      >
        <Text style={styles.workoutName} numberOfLines={2}>{item.workoutName}</Text>
        <Text style={styles.dateText}>{formatDate(item.endedAt, true)}</Text>
        <View style={styles.metricsRow}>
          <SmallMetric icon="timer-outline" text={formatDuration(item.durationSeconds)} />
          <SmallMetric icon="check-circle-outline" text={`${item.totalSets} séries`} />
          <SmallMetric icon="repeat" text={`${item.totalReps} reps`} />
        </View>
        <View style={styles.openRow}><Text style={styles.openText}>Ver resumo</Text><MaterialCommunityIcons name="arrow-right" size={20} color={colors.accent} /></View>
      </Pressable>
    </View>
  );
}

function HistoryDetailModal({ item, onClose, onDelete }: { item: HistoryItem | null; onClose: () => void; onDelete: (item: HistoryItem) => void }) {
  if (!item) return null;
  const completedExercises = item.exercises.filter((exercise) => exercise.sets.some((set) => set.completed));
  return (
    <AdaptiveModal
      visible
      onRequestClose={onClose}
      title={item.workoutName}
      maxWidth={820}
      footer={
        <View style={styles.detailFooter}>
          <AppButton label="Excluir registro" icon="trash-can-outline" variant="danger" onPress={() => onDelete(item)} />
          <AppButton label="Fechar" onPress={onClose} />
        </View>
      }
    >
      <View style={styles.detailHero}>
        <View style={styles.detailCheck}><MaterialCommunityIcons name="check" size={38} color={colors.accent} /></View>
        <View style={styles.detailHeroCopy}>
          <Text style={styles.detailEyebrow}>TREINO CONCLUÍDO</Text>
          <Text style={styles.detailDate}>{formatDate(item.endedAt, true)}</Text>
        </View>
      </View>

      <View style={styles.detailMetrics}>
        <SummaryCard icon="timer-outline" value={formatDuration(item.durationSeconds)} label="duração" />
        <SummaryCard icon="check-circle-outline" value={String(item.totalSets)} label="séries" />
        <SummaryCard icon="repeat" value={String(item.totalReps)} label="repetições" />
      </View>

      <SectionHeader title="Exercícios realizados" trailing={`${completedExercises.length} no total`} />
      <View style={styles.exerciseList}>
        {completedExercises.map((exercise) => {
          const completedSets = exercise.sets.filter((set) => set.completed);
          return (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseIcon}><MaterialCommunityIcons name="dumbbell" size={20} color={colors.accent} /></View>
                <View style={styles.exerciseCopy}>
                  <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                  <Text style={styles.exerciseMeta}>{completedSets.length} de {exercise.sets.length} séries concluídas</Text>
                </View>
              </View>
              {completedSets.length ? (
                <View style={styles.setChips}>
                  {completedSets.map((set) => <Text key={set.id} style={styles.setChip}>S{set.setNumber}: {set.reps} reps</Text>)}
                </View>
              ) : <Text style={styles.noSets}>Nenhuma série concluída.</Text>}
            </View>
          );
        })}
      </View>
    </AdaptiveModal>
  );
}

function SmallMetric({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return <View style={styles.smallMetric}><MaterialCommunityIcons name={icon} size={16} color={colors.textMuted} /><Text style={styles.smallMetricText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: spacing.xl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { gap: 4 },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryCard: { flexGrow: 1, flexBasis: 180, minWidth: 150, gap: spacing.xs },
  summaryIcon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  summaryValue: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  summaryLabel: { color: colors.textMuted, fontSize: typography.caption },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  historyCard: { minWidth: 260, minHeight: 240, flexGrow: 1, padding: spacing.lg, gap: spacing.sm, borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  historyOpen: { flex: 1, gap: spacing.sm },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completedIcon: { width: 46, height: 46, borderRadius: radii.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  workoutName: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  dateText: { color: colors.textMuted, fontSize: typography.small },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallMetric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  smallMetricText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  openRow: { marginTop: 'auto', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openText: { color: colors.accent, fontSize: typography.small, fontWeight: '800' },
  detailFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
  detailHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: '#172114' },
  detailCheck: { width: 66, height: 66, borderRadius: radii.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  detailHeroCopy: { gap: 4 },
  detailEyebrow: { color: colors.accent, fontSize: typography.caption, fontWeight: '900', letterSpacing: 1 },
  detailDate: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  detailMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exerciseList: { gap: spacing.sm },
  exerciseCard: { padding: spacing.md, gap: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  exerciseCopy: { flex: 1, gap: 3 },
  exerciseName: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  exerciseMeta: { color: colors.textMuted, fontSize: typography.caption },
  setChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  setChip: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.backgroundRaised },
  noSets: { color: colors.textSubtle, fontSize: typography.caption, fontStyle: 'italic' },
});
