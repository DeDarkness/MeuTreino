import { Platform } from 'react-native';

export const colors = {
  background: '#0E1115',
  backgroundRaised: '#14191F',
  surface: '#1B222A',
  surfaceRaised: '#232C35',
  surfacePressed: '#2A3540',
  border: '#33404C',
  borderSoft: 'rgba(255,255,255,0.08)',
  accent: '#A6F033',
  accentStrong: '#89D51F',
  accentSoft: '#263A17',
  text: '#F7F9FA',
  textMuted: '#A8B2BC',
  textSubtle: '#7F8A95',
  danger: '#FF6B6B',
  dangerSoft: '#3A2023',
  warning: '#FFB84D',
  warningSoft: '#392C19',
  success: '#58D68D',
  info: '#66B5FF',
  overlay: 'rgba(4, 7, 10, 0.78)',
  white: '#FFFFFF',
  black: '#071006',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: 34,
  title: 28,
  heading: 21,
  body: 16,
  small: 14,
  caption: 12,
} as const;

export const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {};

export const cardShadow = Platform.select({
  web: {
    boxShadow: '0 12px 34px rgba(0, 0, 0, 0.22)',
  },
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
});
