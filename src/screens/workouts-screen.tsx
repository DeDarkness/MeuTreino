import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { ActiveSessionScreen } from '@/components/session/active-session-screen';
import {
  AdaptiveModal,
  AppButton,
  Card,
  EmptyState,
  IconButton,
  SectionHeader,
} from '@/components/ui/primitives';
import { WorkoutEditor } from '@/components/workouts/workout-editor';
import { useWorkoutApp } from '@/context/workout-app-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatRest, sessionCompletedSets, sessionProgress, sessionTotalSets } from '@/lib/workout-domain';
import { confirmDialog } from '@/services/confirm-dialog';
import { colors, radii, spacing, typography, webPointer } from '@/theme/tokens';
import type { Workout } from '@/types/models';

export function WorkoutsScreen() {
  const { data, saveWorkout, deleteWorkout, startWorkout } = useWorkoutApp();
  const { isPhone, cardColumns } = useResponsiveLayout();
  const [editorVisible, setEditorVisible] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [activeVisible, setActiveVisible] = useState(false);
  const isWebEditor = Platform.OS === 'web';

  const cardBasis = cardColumns === 1 ? '100%' : cardColumns === 2 ? '48.5%' : '31.8%';
  const exerciseCount = useMemo(
    () => data.workouts.reduce((total, workout) => total + workout.exercises.length, 0),
    [data.workouts],
  );

  const openNewWorkout = () => {
    setWorkoutToEdit(null);
    setEditorVisible(true);
  };

  const openEditor = (workout: Workout) => {
    setSelectedWorkout(null);
    setWorkoutToEdit(workout);
    setEditorVisible(true);
  };

  const confirmDelete = async (workout: Workout) => {
    const confirmed = await confirmDialog({
      title: 'Excluir treino?',
      message: `“${workout.name}” será removido. O histórico já registrado não será afetado.`,
      cancelLabel: 'Cancelar',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;

    deleteWorkout(workout.id);
    setSelectedWorkout(null);
  };

  const beginWorkout = (workout: Workout) => {
    if (!data.activeSession) {
      startWorkout(workout);
    }
    setSelectedWorkout(null);
    setActiveVisible(true);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: isPhone ? 30 : 44 }]}
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderCopy}>
            <Text accessibilityRole="header" style={styles.pageTitle}>Treinos</Text>
            <Text style={styles.pageSubtitle}>
              {isWebEditor
                ? 'Editor complementar para organizar no computador e continuar no iPhone.'
                : 'Seu treino no iPhone, sempre à mão.'}
            </Text>
          </View>
          <AppButton label="Novo treino" icon="plus" onPress={openNewWorkout} compact={!isPhone} />
        </View>

        <View style={[styles.hero, isPhone && styles.heroPhone]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{greeting().toUpperCase()}</Text>
            <Text style={styles.heroTitle}>Pronto para evoluir?</Text>
            <Text style={styles.heroSubtitle}>{todayLabel()}</Text>
          </View>
          <View style={styles.heroMetrics}>
            <Metric icon="clipboard-text-outline" value={String(data.workouts.length)} label="treinos" />
            <Metric icon="dumbbell" value={String(exerciseCount)} label="exercícios" />
            <Metric icon="check-circle-outline" value={String(data.history.length)} label="concluídos" />
          </View>
          <View style={[styles.heroDecoration, styles.ignorePointerEvents]}>
            <MaterialCommunityIcons name="arm-flex" size={118} color="rgba(166,240,51,0.10)" />
          </View>
        </View>

        {!isWebEditor && data.activeSession ? (
          <ActiveSessionCard onOpen={() => setActiveVisible(true)} />
        ) : null}

        <SectionHeader title="Meus treinos" trailing={data.workouts.length ? `${data.workouts.length} salvos` : undefined} />

        {data.workouts.length === 0 ? (
          <EmptyState
            icon="dumbbell"
            title="Monte seu primeiro treino"
            message={isWebEditor
              ? 'Cadastre exercícios, séries, repetições e descansos com o teclado. Depois, sincronize e execute no iPhone.'
              : 'Adicione exercícios, séries, repetições e descanso. Tudo fica salvo no iPhone e pode ser sincronizado.'}
            action={<AppButton label="Criar treino" icon="plus" onPress={openNewWorkout} />}
          />
        ) : (
          <View style={styles.workoutGrid}>
            {data.workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                basis={cardBasis}
                onOpen={() => setSelectedWorkout(workout)}
                onEdit={() => openEditor(workout)}
                onDelete={() => confirmDelete(workout)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <WorkoutEditor
        visible={editorVisible}
        workout={workoutToEdit}
        onClose={() => setEditorVisible(false)}
        onSave={(workout) => {
          saveWorkout(workout);
          setEditorVisible(false);
        }}
      />

      <WorkoutDetailModal
        workout={selectedWorkout}
        activeWorkoutName={data.activeSession?.workoutName ?? null}
        onClose={() => setSelectedWorkout(null)}
        onEdit={openEditor}
        onDelete={confirmDelete}
        onStart={beginWorkout}
        canStart={!isWebEditor}
      />

      {!isWebEditor ? <ActiveSessionScreen visible={activeVisible} onClose={() => setActiveVisible(false)} /> : null}
    </View>
  );
}

function ActiveSessionCard({ onOpen }: { onOpen: () => void }) {
  const { data } = useWorkoutApp();
  const session = data.activeSession;
  if (!session) return null;
  const completed = sessionCompletedSets(session);
  const total = sessionTotalSets(session);
  const progress = sessionProgress(session);

  return (
    <Card style={styles.activeCard}>
      <View style={styles.activeTopRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>EM ANDAMENTO</Text>
        </View>
        <Text style={styles.activeCount}>{completed}/{total} séries</Text>
      </View>
      <Text style={styles.activeTitle}>{session.workoutName}</Text>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
        <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 2)}%` }]} />
      </View>
      <AppButton label="Continuar treino" icon="play" onPress={onOpen} fullWidth />
    </Card>
  );
}

function WorkoutCard({
  workout,
  basis,
  onOpen,
  onEdit,
  onDelete,
}: {
  workout: Workout;
  basis: DimensionValue;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.targetSets, 0);
  return (
    <View style={[styles.workoutCard, { flexBasis: basis }]}>
      <View style={styles.workoutCardTop}>
        <View style={styles.workoutIcon}>
          <MaterialCommunityIcons name="dumbbell" color={colors.accent} size={25} />
        </View>
        <View style={styles.cardActions}>
          <IconButton icon="pencil-outline" label={`Editar ${workout.name}`} onPress={onEdit} />
          <IconButton icon="trash-can-outline" label={`Excluir ${workout.name}`} danger onPress={onDelete} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir treino ${workout.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.workoutOpen, pressed && styles.cardPressed, webPointer]}
      >
        <Text style={styles.workoutName} numberOfLines={2}>{workout.name}</Text>
        {workout.notes ? <Text style={styles.workoutNotes} numberOfLines={2}>{workout.notes}</Text> : null}
        <View style={styles.workoutMeta}>
          <Meta icon="format-list-bulleted" text={`${workout.exercises.length} exercícios`} />
          <Meta icon="repeat" text={`${totalSets} séries`} />
        </View>
        <View style={styles.openRow}>
          <Text style={styles.openText}>Ver treino</Text>
          <MaterialCommunityIcons name="arrow-right" color={colors.accent} size={20} />
        </View>
      </Pressable>
    </View>
  );
}

function WorkoutDetailModal({
  workout,
  activeWorkoutName,
  onClose,
  onEdit,
  onDelete,
  onStart,
  canStart,
}: {
  workout: Workout | null;
  activeWorkoutName: string | null;
  onClose: () => void;
  onEdit: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onStart: (workout: Workout) => void;
  canStart: boolean;
}) {
  if (!workout) return null;
  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.targetSets, 0);
  return (
    <AdaptiveModal
      visible
      onRequestClose={onClose}
      title={workout.name}
      maxWidth={820}
      footer={
        <View style={styles.detailFooter}>
          <AppButton label="Editar" icon="pencil-outline" variant="secondary" onPress={() => onEdit(workout)} />
          {canStart ? (
            <AppButton
              label={activeWorkoutName ? `Continuar ${activeWorkoutName}` : 'Começar treino'}
              icon={activeWorkoutName ? 'arrow-right-circle' : 'play'}
              onPress={() => onStart(workout)}
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.detailHero}>
        <View style={styles.detailHeroIcon}>
          <MaterialCommunityIcons name="arm-flex" color={colors.accent} size={40} />
        </View>
        <View style={styles.detailMetrics}>
          <Metric icon="format-list-bulleted" value={String(workout.exercises.length)} label="exercícios" />
          <Metric icon="repeat" value={String(totalSets)} label="séries" />
        </View>
      </View>

      {canStart && activeWorkoutName && activeWorkoutName !== workout.name ? (
        <View style={styles.warningBox}>
          <MaterialCommunityIcons name="information-outline" color={colors.warning} size={20} />
          <Text style={styles.warningText}>Você já tem “{activeWorkoutName}” em andamento. O botão continuará esse treino.</Text>
        </View>
      ) : null}

      <SectionHeader title="Exercícios" trailing={`${workout.exercises.length} no total`} />
      <View style={styles.detailList}>
        {[...workout.exercises].sort((a, b) => a.order - b.order).map((exercise, index) => (
          <View key={exercise.id} style={styles.detailExercise}>
            <View style={styles.detailNumber}><Text style={styles.detailNumberText}>{index + 1}</Text></View>
            <View style={styles.detailExerciseCopy}>
              <Text style={styles.detailExerciseName}>{exercise.exerciseName}</Text>
              <Text style={styles.detailExerciseMeta}>{exercise.targetSets} × {exercise.targetReps} repetições</Text>
            </View>
            <View style={styles.restPill}>
              <MaterialCommunityIcons name="timer-outline" size={16} color={colors.textMuted} />
              <Text style={styles.restPillText}>{formatRest(exercise.restSeconds)}</Text>
            </View>
          </View>
        ))}
      </View>

      <AppButton label="Excluir este treino" icon="trash-can-outline" variant="danger" onPress={() => onDelete(workout)} />
    </AdaptiveModal>
  );
}

function Metric({ icon, value, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; value: string; label: string }) {
  return (
    <View style={styles.metric} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.metricIcon}><MaterialCommunityIcons name={icon} size={18} color={colors.accent} /></View>
      <View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return <View style={styles.meta}><MaterialCommunityIcons name={icon} color={colors.textMuted} size={16} /><Text style={styles.metaText}>{text}</Text></View>;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function todayLabel() {
  const formatted = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingTop: spacing.xl, gap: spacing.xl },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  pageHeaderCopy: { flex: 1, gap: 4 },
  pageTitle: { color: colors.text, fontSize: typography.title, fontWeight: '900', letterSpacing: -0.7 },
  pageSubtitle: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  hero: { minHeight: 220, borderRadius: radii.xl, padding: spacing.xxl, backgroundColor: '#172114', overflow: 'hidden', justifyContent: 'space-between', gap: spacing.xl },
  heroPhone: { padding: spacing.lg },
  heroCopy: { gap: spacing.xs, zIndex: 1 },
  eyebrow: { color: colors.accent, fontSize: typography.caption, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.text, fontSize: typography.display, fontWeight: '900', letterSpacing: -1.2 },
  heroSubtitle: { color: colors.textMuted, fontSize: typography.body },
  heroMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, zIndex: 1 },
  heroDecoration: { position: 'absolute', right: 22, bottom: -8 },
  ignorePointerEvents: { pointerEvents: 'none' },
  metric: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricIcon: { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: colors.text, fontSize: typography.body, fontWeight: '900' },
  metricLabel: { color: colors.textMuted, fontSize: typography.caption },
  activeCard: { gap: spacing.md, borderColor: colors.accentStrong },
  activeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.accent },
  liveText: { color: colors.accent, fontSize: typography.caption, fontWeight: '900', letterSpacing: 0.8 },
  activeCount: { color: colors.textMuted, fontSize: typography.small, fontWeight: '700' },
  activeTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  progressTrack: { height: 8, backgroundColor: colors.backgroundRaised, borderRadius: radii.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  workoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  workoutCard: { minWidth: 260, minHeight: 250, flexGrow: 1, backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, gap: spacing.md },
  workoutOpen: { flex: 1, gap: spacing.md },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  workoutCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutIcon: { width: 50, height: 50, backgroundColor: colors.accentSoft, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardActions: { flexDirection: 'row' },
  workoutName: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  workoutNotes: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  workoutMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  openRow: { marginTop: 'auto', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openText: { color: colors.accent, fontSize: typography.small, fontWeight: '800' },
  detailFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
  detailHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, padding: spacing.lg, backgroundColor: '#172114', borderRadius: radii.lg },
  detailHeroIcon: { width: 74, height: 74, borderRadius: radii.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  detailMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.warningSoft },
  warningText: { flex: 1, color: colors.warning, fontSize: typography.small, lineHeight: 20 },
  detailList: { gap: spacing.xs },
  detailExercise: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface },
  detailNumber: { width: 36, height: 36, borderRadius: radii.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  detailNumberText: { color: colors.black, fontWeight: '900' },
  detailExerciseCopy: { flex: 1, minWidth: 0, gap: 3 },
  detailExerciseName: { color: colors.text, fontSize: typography.small, fontWeight: '800' },
  detailExerciseMeta: { color: colors.textMuted, fontSize: typography.caption },
  restPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, minHeight: 34, borderRadius: radii.pill, backgroundColor: colors.backgroundRaised },
  restPillText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
});
