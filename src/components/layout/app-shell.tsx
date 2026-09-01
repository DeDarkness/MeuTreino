import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui/primitives';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { colors, radii, spacing, typography, webPointer } from '@/theme/tokens';

export type AppSection = 'workouts' | 'history' | 'sync';
export type SyncVisualState = 'local' | 'offline' | 'syncing' | 'synced' | 'error';

type AppShellProps = PropsWithChildren<{
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
  syncState: SyncVisualState;
  userEmail?: string | null;
}>;

type NavItemDefinition = { id: AppSection; label: string; icon: IconName };

const navItems: NavItemDefinition[] = [
  { id: 'workouts', label: 'Treinos', icon: 'dumbbell' },
  { id: 'history', label: 'Histórico', icon: 'history' },
  { id: 'sync', label: 'Sincronizar', icon: 'cloud-sync-outline' },
];

const mobileNavItems: NavItemDefinition[] = [
  { id: 'workouts', label: 'Treinos', icon: 'dumbbell' },
  { id: 'history', label: 'Histórico', icon: 'history' },
  { id: 'sync', label: 'Conta', icon: 'account-circle-outline' },
];

export function AppShell({ children, section, onSectionChange, syncState, userEmail }: AppShellProps) {
  const { isDesktop, isPhone, contentMaxWidth, pagePadding } = useResponsiveLayout();
  const compactNavItems = isDesktop ? navItems : mobileNavItems;

  return (
    <SafeAreaView style={[styles.safeArea, !isDesktop && styles.safeAreaMobile]} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.root}>
        {isDesktop ? (
          <View style={styles.sidebar}>
            <Brand compact={false} />
            <View style={styles.desktopNav}>
              {navItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={section === item.id}
                  onPress={() => onSectionChange(item.id)}
                  desktop
                />
              ))}
            </View>
            <View style={styles.sidebarFooter}>
              <SyncBadge state={syncState} />
              {userEmail ? <Text style={styles.userEmail} numberOfLines={1}>{userEmail}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.main}>
          {!isDesktop ? (
            <View style={styles.mobileHeader}>
              <Brand compact />
              {!(isPhone && syncState === 'local') ? <SyncBadge state={syncState} compact /> : null}
            </View>
          ) : null}

          <View style={[styles.contentFrame, { maxWidth: contentMaxWidth, paddingHorizontal: pagePadding }]}>
            {children}
          </View>

          {!isDesktop ? (
            <View style={[styles.bottomNav, isPhone ? styles.bottomNavPhone : null]}>
              {compactNavItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={section === item.id}
                  onPress={() => onSectionChange(item.id)}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Brand({ compact }: { compact: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandIcon}>
        <MaterialCommunityIcons name="dumbbell" color={colors.black} size={compact ? 22 : 25} />
      </View>
      <View>
        <Text style={styles.brandName}>MeuTreino</Text>
        {!compact ? <Text style={styles.brandTagline}>Seu ritmo. Seu progresso.</Text> : null}
      </View>
    </View>
  );
}

function NavItem({
  item,
  active,
  onPress,
  desktop = false,
}: {
  item: NavItemDefinition;
  active: boolean;
  onPress: () => void;
  desktop?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        desktop ? styles.desktopNavItem : styles.mobileNavItem,
        active && styles.navItemActive,
        pressed && styles.navPressed,
        webPointer,
      ]}
    >
      <MaterialCommunityIcons
        name={active ? item.icon : item.icon}
        color={active ? colors.accent : colors.textMuted}
        size={desktop ? 23 : 22}
      />
      <Text style={[desktop ? styles.desktopNavText : styles.mobileNavText, active && styles.navTextActive]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

export function SyncBadge({ state, compact = false }: { state: SyncVisualState; compact?: boolean }) {
  const config = syncStateConfig[state];
  return (
    <View
      accessibilityLabel={`Sincronização: ${config.label}`}
      style={[styles.syncBadge, compact && styles.syncBadgeCompact]}
    >
      <MaterialCommunityIcons name={config.icon} color={config.color} size={15} />
      <Text style={[styles.syncText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const syncStateConfig: Record<SyncVisualState, { label: string; color: string; icon: IconName }> = {
  local: { label: 'Neste aparelho', color: colors.textMuted, icon: 'cellphone' },
  offline: { label: 'Offline', color: colors.warning, icon: 'cloud-off-outline' },
  syncing: { label: 'Sincronizando', color: colors.info, icon: 'cloud-sync-outline' },
  synced: { label: 'Sincronizado', color: colors.success, icon: 'cloud-check-outline' },
  error: { label: 'Erro de sync', color: colors.danger, icon: 'cloud-alert' },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeAreaMobile: {
    backgroundColor: colors.backgroundRaised,
  },
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 246,
    padding: spacing.xl,
    backgroundColor: colors.backgroundRaised,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
  },
  brand: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTagline: {
    color: colors.textMuted,
    fontSize: 11,
  },
  desktopNav: {
    marginTop: spacing.xxxl,
    gap: spacing.xs,
  },
  desktopNavItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  desktopNavText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  navItemActive: {
    backgroundColor: colors.accentSoft,
  },
  navTextActive: {
    color: colors.accent,
  },
  navPressed: {
    opacity: 0.72,
  },
  sidebarFooter: {
    marginTop: 'auto',
    gap: spacing.xs,
  },
  userEmail: {
    color: colors.textSubtle,
    fontSize: typography.caption,
    paddingHorizontal: spacing.xs,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  mobileHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.backgroundRaised,
  },
  contentFrame: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  bottomNav: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.backgroundRaised,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  bottomNavPhone: {
    minHeight: 76,
  },
  mobileNavItem: {
    minWidth: 82,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radii.md,
  },
  mobileNavText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  syncBadge: {
    alignSelf: 'flex-start',
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  syncBadgeCompact: {
    paddingHorizontal: spacing.xs,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
