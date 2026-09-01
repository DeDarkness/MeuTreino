import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AdaptiveModal,
  AppButton,
  Card,
  ChoiceChip,
  Field,
  IconButton,
  NumberControl,
  SectionHeader,
} from '@/components/ui/primitives';
import { useWorkoutApp } from '@/context/workout-app-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { createId, nowIso } from '@/lib/id';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import type { Workout, WorkoutExercise } from '@/types/models';

type WorkoutEditorProps = {
  visible: boolean;
  workout: Workout | null;
  onClose: () => void;
  onSave: (workout: Workout) => void;
};

const restPresets = [0, 30, 45, 60, 90, 120];

function blankExercise(order: number, defaultRestSeconds: number): WorkoutExercise {
  const id = createId('workout_exercise');
  return {
    id,
    exerciseId: createId('exercise'),
    exerciseName: '',
    order,
    targetSets: 3,
    targetReps: 10,
    restSeconds: defaultRestSeconds,
  };
}

export function WorkoutEditor({ visible, workout, onClose, onSave }: WorkoutEditorProps) {
  if (!visible) return null;
  return (
    <WorkoutEditorForm
      key={workout?.id ?? 'new-workout'}
      visible={visible}
      workout={workout}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function WorkoutEditorForm({ visible, workout, onClose, onSave }: WorkoutEditorProps) {
  const { data } = useWorkoutApp();
  const { isPhone } = useResponsiveLayout();
  const defaultRestSeconds = data.preferences.defaultRestSeconds;
  const [name, setName] = useState(workout?.name ?? '');
  const [notes, setNotes] = useState(workout?.notes ?? '');
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() =>
    workout?.exercises.length
      ? workout.exercises.map((exercise) => ({ ...exercise }))
      : [blankExercise(0, defaultRestSeconds)],
  );
  const [submitted, setSubmitted] = useState(false);

  const isValid = useMemo(
    () => name.trim().length > 0 && exercises.length > 0 && exercises.every((exercise) => exercise.exerciseName.trim().length > 0),
    [exercises, name],
  );

  const updateExercise = (id: string, patch: Partial<WorkoutExercise>) => {
    setExercises((current) => current.map((exercise) => (exercise.id === id ? { ...exercise, ...patch } : exercise)));
  };

  const removeExercise = (id: string) => {
    setExercises((current) => current.filter((exercise) => exercise.id !== id).map((exercise, order) => ({ ...exercise, order })));
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= exercises.length) return;
    setExercises((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next.map((exercise, order) => ({ ...exercise, order }));
    });
  };

  const save = () => {
    setSubmitted(true);
    if (!isValid) return;
    const timestamp = nowIso();
    onSave({
      id: workout?.id ?? createId('workout'),
      name: name.trim(),
      notes: notes.trim() || undefined,
      exercises: exercises.map((exercise, order) => ({
        ...exercise,
        exerciseName: exercise.exerciseName.trim(),
        order,
      })),
      createdAt: workout?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  };

  return (
    <AdaptiveModal
      visible={visible}
      onRequestClose={onClose}
      title={workout ? 'Editar treino' : 'Novo treino'}
      maxWidth={880}
      footer={
        <View style={styles.footerRow}>
          <AppButton label="Cancelar" variant="ghost" onPress={onClose} />
          <AppButton
            label={workout ? 'Salvar alterações' : 'Salvar treino'}
            icon="content-save-outline"
            onPress={save}
            disabled={submitted && !isValid}
          />
        </View>
      }
    >
      <View style={styles.introRow}>
        <View style={styles.introIcon}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={26} color={colors.accent} />
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>Monte sua ficha</Text>
          <Text style={styles.introText}>Defina cada exercício e o descanso. Você poderá ajustar as repetições durante o treino.</Text>
        </View>
      </View>

      <View style={[styles.formRow, isPhone && styles.formColumn]}>
        <Field
          label="Nome do treino"
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Treino A — Peito e tríceps"
          error={submitted && !name.trim() ? 'Informe um nome para o treino.' : undefined}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Field
          label="Observações (opcional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Objetivo, intensidade, orientação..."
          returnKeyType="done"
        />
      </View>

      <SectionHeader title="Exercícios" trailing={`${exercises.length}/20`} />

      <View style={styles.exerciseList}>
        {exercises.map((exercise, index) => (
          <ExerciseEditorCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            total={exercises.length}
            showError={submitted && !exercise.exerciseName.trim()}
            onChange={(patch) => updateExercise(exercise.id, patch)}
            onDelete={() => removeExercise(exercise.id)}
            onMove={(direction) => moveExercise(index, direction)}
          />
        ))}
      </View>

      {exercises.length < 20 ? (
        <AppButton
          label="Adicionar exercício"
          icon="plus-circle-outline"
          variant="secondary"
          fullWidth
          onPress={() => setExercises((current) => [...current, blankExercise(current.length, defaultRestSeconds)])}
        />
      ) : null}

      <View style={styles.notice}>
        <MaterialCommunityIcons name="bell-ring-outline" color={colors.warning} size={20} />
        <Text style={styles.noticeText}>
          O alerta sonoro usa uma notificação no celular. Os modos Silencioso e Foco podem impedir o áudio.
        </Text>
      </View>
    </AdaptiveModal>
  );
}

function ExerciseEditorCard({
  exercise,
  index,
  total,
  showError,
  onChange,
  onDelete,
  onMove,
}: {
  exercise: WorkoutExercise;
  index: number;
  total: number;
  showError: boolean;
  onChange: (patch: Partial<WorkoutExercise>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { isPhone } = useResponsiveLayout();
  const isPreset = restPresets.includes(exercise.restSeconds);

  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseNumber}>
          <Text style={styles.exerciseNumberText}>{index + 1}</Text>
        </View>
        <Text style={styles.exerciseHeading}>Exercício {index + 1}</Text>
        <View style={styles.exerciseActions}>
          <IconButton
            icon="arrow-up"
            label={`Mover exercício ${index + 1} para cima`}
            disabled={index === 0}
            onPress={() => onMove(-1)}
          />
          <IconButton
            icon="arrow-down"
            label={`Mover exercício ${index + 1} para baixo`}
            disabled={index === total - 1}
            onPress={() => onMove(1)}
          />
          {total > 1 ? <IconButton icon="trash-can-outline" label={`Excluir exercício ${index + 1}`} danger onPress={onDelete} /> : null}
        </View>
      </View>

      <Field
        label="Nome do exercício"
        value={exercise.exerciseName}
        onChangeText={(exerciseName) => onChange({ exerciseName })}
        placeholder="Ex.: Supino reto"
        error={showError ? 'Informe o nome do exercício.' : undefined}
        autoCapitalize="words"
      />

      <View style={[styles.controlsRow, isPhone && styles.controlsColumn]}>
        <NumberControl
          label="Séries"
          value={exercise.targetSets}
          onChange={(targetSets) => onChange({ targetSets })}
          min={1}
          max={20}
        />
        <NumberControl
          label="Repetições"
          value={exercise.targetReps}
          onChange={(targetReps) => onChange({ targetReps })}
          min={1}
          max={999}
        />
        <NumberControl
          label="Descanso"
          value={exercise.restSeconds}
          onChange={(restSeconds) => onChange({ restSeconds })}
          min={0}
          max={1800}
          step={15}
          suffix="s"
        />
      </View>

      <View style={styles.restBlock}>
        <Text style={styles.restLabel}>Atalhos de descanso</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {restPresets.map((seconds) => (
            <ChoiceChip
              key={seconds}
              label={seconds === 0 ? 'Sem descanso' : seconds < 60 ? `${seconds} s` : `${seconds / 60} min`}
              selected={exercise.restSeconds === seconds}
              onPress={() => onChange({ restSeconds: seconds })}
            />
          ))}
          {!isPreset ? <ChoiceChip label={`${exercise.restSeconds} s`} selected onPress={() => undefined} /> : null}
        </ScrollView>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
  },
  introIcon: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundRaised,
  },
  introCopy: {
    flex: 1,
    gap: 3,
  },
  introTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  introText: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 20,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  formColumn: {
    flexDirection: 'column',
  },
  exerciseList: {
    gap: spacing.md,
  },
  exerciseCard: {
    gap: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseNumber: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  exerciseNumberText: {
    color: colors.black,
    fontSize: typography.small,
    fontWeight: '900',
  },
  exerciseHeading: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlsColumn: {
    flexWrap: 'wrap',
  },
  restBlock: {
    gap: spacing.xs,
  },
  restLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  chipsRow: {
    gap: spacing.xs,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
  },
  noticeText: {
    flex: 1,
    color: colors.warning,
    fontSize: typography.small,
    lineHeight: 20,
  },
});
