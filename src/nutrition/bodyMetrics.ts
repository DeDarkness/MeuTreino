export const EXTRA_CIRCUMFERENCES = {
  abdomenCm: 'Abdômen', shoulderCm: 'Ombros',
  rightArmRelaxedCm: 'Braço direito relaxado', leftArmRelaxedCm: 'Braço esquerdo relaxado',
  rightArmFlexedCm: 'Braço direito contraído', leftArmFlexedCm: 'Braço esquerdo contraído',
  rightForearmCm: 'Antebraço direito', leftForearmCm: 'Antebraço esquerdo',
  rightThighCm: 'Coxa direita', leftThighCm: 'Coxa esquerda',
  rightCalfCm: 'Panturrilha direita', leftCalfCm: 'Panturrilha esquerda',
} as const;

export const BODY_METRICS = {
  weightKg: 'Peso',
  waistCm: 'Cintura',
  ...EXTRA_CIRCUMFERENCES,
  chestCm: 'Peito',
  hipCm: 'Quadril',
  armCm: 'Braço sem lado especificado',
  thighCm: 'Coxa sem lado especificado',
  calfCm: 'Panturrilha sem lado especificado',
  bodyFat: 'Gordura estimada',
} as const;

export type BodyMetric = keyof typeof BODY_METRICS;
export const BODY_METRIC_KEYS = Object.keys(BODY_METRICS) as BodyMetric[];

export function bodyMetricUnit(metric: BodyMetric) {
  return metric === 'weightKg' ? 'kg' : metric === 'bodyFat' ? '%' : 'cm';
}
