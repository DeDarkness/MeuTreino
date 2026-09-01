import { useWindowDimensions } from 'react-native';

export type LayoutMode = 'phone' | 'tablet' | 'desktop';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const mode: LayoutMode = width < 768 ? 'phone' : width < 1100 ? 'tablet' : 'desktop';

  return {
    width,
    height,
    fontScale,
    mode,
    isPhone: mode === 'phone',
    isTablet: mode === 'tablet',
    isDesktop: mode === 'desktop',
    isShortLandscape: width > height && height < 540,
    contentMaxWidth: mode === 'desktop' ? 1320 : mode === 'tablet' ? 960 : width,
    pagePadding: mode === 'phone' ? 16 : mode === 'tablet' ? 24 : 32,
    cardColumns: mode === 'phone' ? 1 : mode === 'tablet' ? 2 : 3,
  };
}
