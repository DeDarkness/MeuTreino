import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AdaptiveModal,
  AppButton,
  Card,
  IconButton,
  SectionHeader,
} from '@/components/ui/primitives';
import { useWorkoutApp } from '@/context/workout-app-context';
import {
  findNextPendingSet,
  formatClock,
  formatDuration,
  sessionCompletedSets,
  sessionDurationSeconds,
  sessionProgress,
  sessionTotalSets,
} from '@/lib/workout-domain';
import {
  cancelRestAlert,
  primeRestAlertAudio,
  scheduleRestAlert,
} from '@/services/rest-alert';
import { confirmDialog } from '@/services/confirm-dialog';
import { colors, radii, spacing, typography, webPointer } from '@/theme/tokens';
import type { ActiveExercise, ActiveSession, ActiveSet, HistoryItem } from '@/types/models';

type ActiveSessionScreenProps = {
  visible: boolean;
  onClose: () => void;
};

type RestViewState = {
  endAt: string;
  totalSeconds: number;
  nextDescription: string;
};

export function ActiveSessionScreen({ visible, onClose }: ActiveSessionScreenProps) {
  const {
    data,
    updateActiveSession,
    finishActiveWorkout,
    discardActiveWorkout,
  } = useWorkoutApp();
  const session = data.activeSession;
  const sessionId = session?.id;
  const [completion, setCompletion] = useState<HistoryItem | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date().getTime());
  const restAlertKeyRef = useRef<string | null>(null);
  const restAlertSessionIdRef = useRef<string | null>(null);
  const restAlertQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!visible || !sessionId) return;
    const interval = setInterval(() => setClockNow(new Date().getTime()), 1000);
    return () => clearInterval(interval);
  }, [sessionId, visible]);

  const displayedRest = session ? restoreRestViewState(session, clockNow) : null;
  const restEndsAt = displayedRest?.endAt ?? null;
  const restNextDescription = displayedRest?.nextDescription ?? null;
  const soundEnabled = data.preferences.soundEnabled;
  const vibrationEnabled = data.preferences.vibrationEnabled;

  useEffect(() => {
    const previousSessionId = restAlertSessionIdRef.current;
    restAlertSessionIdRef.current = sessionId ?? null;

    const endTime = restEndsAt ? Date.parse(restEndsAt) : Number.NaN;
    const hasFutureRest = Number.isFinite(endTime) && endTime > Date.now();
    const key = sessionId && hasFutureRest
      ? [sessionId, restEndsAt, restNextDescription, soundEnabled, vibrationEnabled].join('|')
      : sessionId
        ? `${sessionId}|clear`
        : 'none';

    if (restAlertKeyRef.current === key && previousSessionId === (sessionId ?? null)) return;
    restAlertKeyRef.current = key;

    const operation = restAlertQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (previousSessionId && previousSessionId !== sessionId) {
          await cancelRestAlert(restAlertId(previousSessionId));
        }

        if (restAlertKeyRef.current !== key || !sessionId) return;

        if (!hasFutureRest || !restEndsAt) {
          await cancelRestAlert(restAlertId(sessionId));
          return;
        }

        await scheduleRestAlert({
          identifier: restAlertId(sessionId),
          endAt: restEndsAt,
          body: restNextDescription
            ? `Próxima: ${restNextDescription}.`
            : 'Hora da próxima série.',
          soundEnabled,
          vibrationEnabled,
          requestPermission: false,
        });
      });

    restAlertQueueRef.current = operation.catch(() => undefined);
  }, [restEndsAt, restNextDescription, sessionId, soundEnabled, vibrationEnabled]);

  if (!session && !completion) return null;

  const toggleSet = (exercise: ActiveExercise, set: ActiveSet) => {
    if (!session) return;
    const timestamp = new Date().toISOString();
    const completing = !set.completed;
    const updatedSession: ActiveSession = {
      ...session,
      updatedAt: timestamp,
      exercises: session.exercises.map((currentExercise) =>
        currentExercise.id !== exercise.id
          ? currentExercise
          : {
              ...currentExercise,
              updatedAt: timestamp,
              sets: currentExercise.sets.map((currentSet) =>
                currentSet.id !== set.id
                  ? currentSet
                  : {
                      ...currentSet,
                      completed: completing,
                      completedAt: completing ? timestamp : null,
                      updatedAt: timestamp,
                    },
              ),
            },
      ),
    };

    if (completing) {
      const next = findNextPendingSet(updatedSession, exercise.id, set.id);
      if (next && exercise.restSeconds > 0) {
        const endAt = new Date(new Date().getTime() + exercise.restSeconds * 1000).toISOString();
        const nextDescription = `Série ${next.set.setNumber} de ${next.exercise.exerciseName}`;
        updatedSession.restEndsAt = endAt;
        updatedSession.restTotalSeconds = exercise.restSeconds;
        updatedSession.restNextDescription = nextDescription;
        void primeRestAlertAudio();
        restAlertSessionIdRef.current = session.id;
        restAlertKeyRef.current = [
          session.id,
          endAt,
          nextDescription,
          data.preferences.soundEnabled,
          data.preferences.vibrationEnabled,
        ].join('|');
        void scheduleRestAlert({
          identifier: restAlertId(session.id),
          endAt,
          body: `Próxima: ${nextDescription}.`,
          soundEnabled: data.preferences.soundEnabled,
          vibrationEnabled: data.preferences.vibrationEnabled,
          requestPermission: true,
        });
      }
    }

    updateActiveSession(updatedSession);
  };

  const changeReps = (exerciseId: string, setId: string, delta: number) => {
    if (!session) return;
    const timestamp = new Date().toISOString();
    updateActiveSession({
      ...session,
      updatedAt: timestamp,
      exercises: session.exercises.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              updatedAt: timestamp,
              sets: exercise.sets.map((set) =>
                set.id !== setId
                  ? set
                  : { ...set, reps: Math.max(0, Math.min(999, set.reps + delta)), updatedAt: timestamp },
              ),
            },
      ),
    });
  };

  const closeRest = () => {
    if (!session) return;
    void cancelRestAlert(restAlertId(session.id));
    updateActiveSession({
      ...session,
      restEndsAt: null,
      restTotalSeconds: null,
      restNextDescription: null,
      updatedAt: new Date().toISOString(),
    });
  };

  const confirmFinish = async () => {
    if (!session) return;
    const pending = sessionTotalSets(session) - sessionCompletedSets(session);
    const confirmed = await confirmDialog({
      title: 'Finalizar treino?',
      message: pending > 0
        ? `Ainda há ${pending} série${pending === 1 ? '' : 's'} pendente${pending === 1 ? '' : 's'}. O progresso atual será salvo.`
        : 'Parabéns! O treino será salvo no histórico.',
      cancelLabel: 'Continuar',
      confirmLabel: 'Finalizar',
    });
    if (!confirmed) return;

    void cancelRestAlert(restAlertId(session.id));
    const item = finishActiveWorkout();
    if (item) setCompletion(item);
  };

  const confirmDiscard = async () => {
    if (!session) return;
    const confirmed = await confirmDialog({
      title: 'Descartar treino?',
      message: 'Todo o progresso desta sessão será apagado.',
      cancelLabel: 'Cancelar',
      confirmLabel: 'Descartar',
      destructive: true,
    });
    if (!confirmed) return;

    void cancelRestAlert(restAlertId(session.id));
    discardActiveWorkout();
    onClose();
  };

  if (completion) {
    return (
      <CompletionModal
        item={completion}
        onDone={() => {
          setCompletion(null);
          onClose();
        }}
      />
    );
  }

  if (!session) return null;

  return (
    <>
      <AdaptiveModal
        visible={visible}
        onRequestClose={onClose}
        title={session.workoutName}
        maxWidth={1080}
        footer={
          <View style={styles.footerRow}>
            <AppButton label="Descartar" icon="trash-can-outline" variant="danger" onPress={confirmDiscard} />
            <AppButton
              label={sessionProgress(session) === 1 ? 'Concluir treino' : 'Finalizar treino'}
              icon="check-circle-outline"
              onPress={confirmFinish}
            />
          </View>
        }
      >
        <SessionHeader session={session} now={clockNow} />

        <SectionHeader title="Séries" trailing={`${sessionCompletedSets(session)}/${sessionTotalSets(session)} concluídas`} />
        <View style={styles.exerciseList}>
          {[...session.exercises].sort((a, b) => a.order - b.order).map((exercise) => (
            <ExerciseProgressCard
              key={exercise.id}
              exercise={exercise}
              onToggle={(set) => toggleSet(exercise, set)}
              onChangeReps={(set, delta) => changeReps(exercise.id, set.id, delta)}
            />
          ))}
        </View>
      </AdaptiveModal>

      <RestTimerOverlay
        rest={displayedRest}
        soundEnabled={data.preferences.soundEnabled}
        onAddTime={(seconds) => {
          if (!session || !displayedRest) return;
          const endAt = new Date(
            new Date(displayedRest.endAt).getTime() + seconds * 1000,
          ).toISOString();
          updateActiveSession({
            ...session,
            restEndsAt: endAt,
            restTotalSeconds: displayedRest.totalSeconds + seconds,
            restNextDescription: displayedRest.nextDescription,
            updatedAt: new Date().toISOString(),
          });
        }}
        onSkip={closeRest}
        onDone={closeRest}
      />
    </>
  );
}

function SessionHeader({ session, now }: { session: ActiveSession; now: number }) {
  const completed = sessionCompletedSets(session);
  const total = sessionTotalSets(session);
  const progress = sessionProgress(session);
  return (
    <View style={styles.sessionHero}>
      <View style={styles.sessionHeroTop}>
        <View>
          <Text style={styles.eyebrow}>TEMPO DE TREINO</Text>
          <Text style={styles.sessionTime}>{formatClock(sessionDurationSeconds(session, now))}</Text>
        </View>
        <ProgressRing progress={progress} size={86} strokeWidth={9} label={`${Math.round(progress * 100)}%`} />
      </View>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: completed }}>
        <View style={[styles.progressFill, { width: `${Math.max(2, progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressText}>{completed} de {total} séries concluídas</Text>
    </View>
  );
}

function ExerciseProgressCard({
  exercise,
  onToggle,
  onChangeReps,
}: {
  exercise: ActiveExercise;
  onToggle: (set: ActiveSet) => void;
  onChangeReps: (set: ActiveSet, delta: number) => void;
}) {
  const completed = exercise.sets.filter((set) => set.completed).length;
  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleWrap}>
          <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
          <Text style={styles.exerciseSubtitle}>{exercise.restSeconds > 0 ? `Descanso de ${exercise.restSeconds} s` : 'Sem descanso automático'}</Text>
        </View>
        <View style={[styles.countBadge, completed === exercise.sets.length && styles.countBadgeDone]}>
          <Text style={[styles.countBadgeText, completed === exercise.sets.length && styles.countBadgeTextDone]}>{completed}/{exercise.sets.length}</Text>
        </View>
      </View>

      <View style={styles.setList}>
        {exercise.sets.map((set) => (
          <View key={set.id} style={[styles.setRow, set.completed && styles.setRowDone]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${set.completed ? 'Desmarcar' : 'Concluir'} série ${set.setNumber} de ${exercise.exerciseName}`}
              accessibilityState={{ checked: set.completed }}
              onPress={() => onToggle(set)}
              style={({ pressed }) => [styles.checkButton, pressed && styles.pressed, webPointer]}
            >
              <MaterialCommunityIcons
                name={set.completed ? 'check-circle' : 'checkbox-blank-circle-outline'}
                size={28}
                color={set.completed ? colors.accent : colors.textSubtle}
              />
            </Pressable>
            <Text style={[styles.setLabel, set.completed && styles.setLabelDone]}>Série {set.setNumber}</Text>
            <View style={styles.repsControl}>
              <IconButton icon="minus" label={`Diminuir repetições da série ${set.setNumber}`} onPress={() => onChangeReps(set, -1)} size={44} />
              <Text style={styles.repsValue}>{set.reps}</Text>
              <IconButton icon="plus" label={`Aumentar repetições da série ${set.setNumber}`} onPress={() => onChangeReps(set, 1)} size={44} />
              <Text style={styles.repsLabel}>reps</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RestTimerOverlay({
  rest,
  soundEnabled,
  onAddTime,
  onSkip,
  onDone,
}: {
  rest: RestViewState | null;
  soundEnabled: boolean;
  onAddTime: (seconds: number) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date().getTime());
  const remaining = rest ? Math.max(0, Math.ceil((new Date(rest.endAt).getTime() - now) / 1000)) : 0;
  const finished = Boolean(rest) && remaining === 0;

  const restEndAt = rest?.endAt;
  useEffect(() => {
    if (!restEndAt) return;
    const interval = setInterval(() => setNow(new Date().getTime()), 250);
    return () => clearInterval(interval);
  }, [restEndAt]);

  if (!rest) return null;
  const progress = rest.totalSeconds > 0 ? remaining / rest.totalSeconds : 0;
  const compactRest = width < 420 || height < 720;
  const ringSize = compactRest
    ? Math.max(180, Math.min(230, width - spacing.lg * 2 - spacing.md * 2))
    : 260;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finished ? onDone : undefined} statusBarTranslucent>
      <SafeAreaView style={styles.restBackdrop} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.restSurface, compactRest && styles.restSurfaceCompact]} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.restTitle}>{finished ? 'Descanso concluído' : 'Descanso'}</Text>
          <Text style={styles.restNext}>Próxima: {rest.nextDescription}</Text>
          <ProgressRing
            progress={progress}
            size={ringSize}
            strokeWidth={compactRest ? 15 : 17}
            label={finished ? '✓' : formatClock(remaining)}
            large
          />
          {finished ? (
            <AppButton label="Voltar ao treino" icon="arrow-right" onPress={onDone} fullWidth />
          ) : (
            <View style={[styles.restActions, compactRest && styles.restActionsCompact]}>
              <AppButton label="+15 s" icon="plus" variant="secondary" onPress={() => onAddTime(15)} />
              <AppButton label="Pular descanso" icon="skip-forward" variant="secondary" onPress={onSkip} />
            </View>
          )}
          <View style={styles.restNotice}>
            <MaterialCommunityIcons name={soundEnabled ? 'volume-high' : 'volume-off'} size={18} color={colors.textMuted} />
            <Text style={styles.restNoticeText}>{soundEnabled ? 'O aviso sonoro está ativado.' : 'O aviso sonoro está desativado.'}</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CompletionModal({ item, onDone }: { item: HistoryItem; onDone: () => void }) {
  return (
    <AdaptiveModal visible onRequestClose={onDone} title="Treino concluído" maxWidth={720} footer={<AppButton label="Voltar aos treinos" icon="home-outline" onPress={onDone} fullWidth />}>
      <View style={styles.completionHero}>
        <View style={styles.completionIcon}><MaterialCommunityIcons name="check" size={52} color={colors.accent} /></View>
        <Text style={styles.completionTitle}>Mandou bem!</Text>
        <Text style={styles.completionName}>{item.workoutName}</Text>
      </View>
      <View style={styles.completionMetrics}>
        <SummaryMetric icon="timer-outline" value={formatDuration(item.durationSeconds)} label="duração" />
        <SummaryMetric icon="check-circle-outline" value={String(item.totalSets)} label="séries" />
        <SummaryMetric icon="repeat" value={String(item.totalReps)} label="repetições" />
      </View>
    </AdaptiveModal>
  );
}

function SummaryMetric({ icon, value, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; value: string; label: string }) {
  return <View style={styles.summaryMetric}><MaterialCommunityIcons name={icon} size={22} color={colors.accent} /><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function ProgressRing({ progress, size, strokeWidth, label, large = false }: { progress: number; size: number; strokeWidth: number; label: string; large?: boolean }) {
  const normalized = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={large ? 'Tempo de descanso restante' : 'Progresso do treino'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalized * 100), text: label }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.10)" strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.accent} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - normalized)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={large ? styles.ringLabelLarge : styles.ringLabel}>{label}</Text>
    </View>
  );
}

function firstPendingSet(session: ActiveSession) {
  for (const exercise of [...session.exercises].sort((a, b) => a.order - b.order)) {
    const set = exercise.sets.find((candidate) => !candidate.completed);
    if (set) return { exercise, set };
  }
  return null;
}

function restoreRestViewState(session: ActiveSession, now: number): RestViewState | null {
  if (!session.restEndsAt) return null;
  const endTime = Date.parse(session.restEndsAt);
  if (!Number.isFinite(endTime)) return null;
  const next = firstPendingSet(session);
  const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
  const configuredRest = session.exercises.reduce(
    (maximum, exercise) => Math.max(maximum, exercise.restSeconds),
    1,
  );
  const persistedTotal = typeof session.restTotalSeconds === 'number'
    && Number.isFinite(session.restTotalSeconds)
    && session.restTotalSeconds > 0
    ? Math.trunc(session.restTotalSeconds)
    : null;
  const persistedDescription = session.restNextDescription?.trim();
  return {
    endAt: session.restEndsAt,
    totalSeconds: Math.max(1, persistedTotal ?? Math.max(remaining, configuredRest)),
    nextDescription: persistedDescription || (next
      ? `Série ${next.set.setNumber} de ${next.exercise.exerciseName}`
      : 'Próxima série'),
  };
}

function restAlertId(sessionId: string) {
  return `rest:${sessionId}`;
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
  sessionHero: { padding: spacing.xl, borderRadius: radii.xl, backgroundColor: '#172114', gap: spacing.md },
  sessionHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  eyebrow: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '900', letterSpacing: 1 },
  sessionTime: { color: colors.text, fontSize: 38, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  ringLabel: { color: colors.text, fontSize: typography.small, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ringLabelLarge: { color: colors.text, fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 9, borderRadius: radii.pill, backgroundColor: colors.backgroundRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.accent },
  progressText: { color: colors.textMuted, fontSize: typography.small, fontWeight: '700' },
  exerciseList: { gap: spacing.md },
  exerciseCard: { gap: spacing.md, padding: spacing.md },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exerciseTitleWrap: { flex: 1, gap: 3 },
  exerciseTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  exerciseSubtitle: { color: colors.textMuted, fontSize: typography.caption },
  countBadge: { minWidth: 48, minHeight: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, backgroundColor: colors.backgroundRaised },
  countBadgeDone: { backgroundColor: colors.accentSoft },
  countBadgeText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '900' },
  countBadgeTextDone: { color: colors.accent },
  setList: { gap: 2, backgroundColor: colors.backgroundRaised, borderRadius: radii.md, overflow: 'hidden' },
  setRow: { minHeight: 62, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  setRowDone: { opacity: 0.72 },
  checkButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  setLabel: { flex: 1, color: colors.text, fontSize: typography.small, fontWeight: '800' },
  setLabelDone: { color: colors.textMuted },
  repsControl: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  repsValue: { minWidth: 30, color: colors.text, fontSize: typography.body, fontWeight: '900', textAlign: 'center', fontVariant: ['tabular-nums'] },
  repsLabel: { width: 30, color: colors.textMuted, fontSize: typography.caption },
  restBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(4,7,10,0.94)' },
  restSurface: { width: '100%', maxWidth: 560, alignItems: 'center', gap: spacing.xl, padding: spacing.xxl, borderRadius: radii.xl, backgroundColor: colors.backgroundRaised, borderWidth: 1, borderColor: colors.border },
  restSurfaceCompact: { gap: spacing.md, padding: spacing.md },
  restTitle: { color: colors.text, fontSize: typography.title, fontWeight: '900', textAlign: 'center' },
  restNext: { color: colors.textMuted, fontSize: typography.body, textAlign: 'center' },
  restActions: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  restActionsCompact: { flexDirection: 'column' },
  restNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs },
  restNoticeText: { flexShrink: 1, color: colors.textMuted, fontSize: typography.caption, textAlign: 'center' },
  completionHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  completionIcon: { width: 112, height: 112, borderRadius: radii.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  completionTitle: { color: colors.text, fontSize: typography.display, fontWeight: '900', textAlign: 'center' },
  completionName: { color: colors.textMuted, fontSize: typography.heading, fontWeight: '700', textAlign: 'center' },
  completionMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryMetric: { flexGrow: 1, minWidth: 140, alignItems: 'center', gap: 5, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface },
  summaryValue: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  summaryLabel: { color: colors.textMuted, fontSize: typography.caption },
});
