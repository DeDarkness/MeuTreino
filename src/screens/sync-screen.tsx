import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AdaptiveModal,
  AppButton,
  Card,
  ChoiceChip,
  Field,
  NumberControl,
  SectionHeader,
  ToggleRow,
} from '@/components/ui/primitives';
import { SyncBadge } from '@/components/layout/app-shell';
import { useWorkoutApp } from '@/context/workout-app-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { REST_ALERT_LIMITATIONS } from '@/services/rest-alert';
import { confirmDialog } from '@/services/confirm-dialog';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type AuthMode = 'signin' | 'signup';

const onlinePrivacyPolicyUrl = (() => {
  const url = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
  return url && /^https:\/\//i.test(url) ? url : null;
})();

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export function SyncScreen() {
  const {
    data,
    session,
    syncStatus,
    syncVisualState,
    isSupabaseConfigured,
    authSignIn,
    authSignUp,
    authSignOut,
    authDeleteAccount,
    syncNow,
    updatePreferences,
  } = useWorkoutApp();
  const { isPhone } = useResponsiveLayout();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  const submitAuth = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    const result = mode === 'signin'
      ? await authSignIn(email, password)
      : await authSignUp(email, password);
    setAuthBusy(false);
    if (result.ok) {
      setAuthMessage(result.needsEmailConfirmation
        ? 'Conta criada. Confirme o e-mail antes de entrar.'
        : 'Conta conectada. Seus dados serão sincronizados.');
      setPassword('');
    } else {
      setAuthMessage(result.error ?? 'Não foi possível concluir a autenticação.');
    }
  };

  const deleteAccount = async () => {
    const confirmed = await confirmDialog({
      title: 'Excluir minha conta?',
      message: 'Isso removerá permanentemente sua conta e os dados sincronizados. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir conta',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!confirmed) return;

    setDeleteAccountBusy(true);
    setDeleteAccountError(null);
    const result = await authDeleteAccount();
    setDeleteAccountBusy(false);
    if (!result.ok) {
      setDeleteAccountError(result.error ?? 'Não foi possível excluir sua conta. Tente novamente.');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: isPhone ? 30 : 44 }]}>
        <View style={[styles.header, isPhone && styles.headerPhone]}>
          <View style={[styles.headerCopy, isPhone && styles.centeredCopy]}>
            <Text accessibilityRole="header" style={[styles.title, isPhone && styles.textCenter]}>Conta e dados</Text>
            <Text style={[styles.subtitle, isPhone && styles.textCenter]}>O iPhone é o seu treino. O editor web é um complemento para organizar a ficha com mais conforto.</Text>
          </View>
          <SyncBadge state={syncVisualState} />
        </View>

        <View style={[styles.twoColumns, isPhone && styles.oneColumn]}>
          <Card style={styles.mainCard}>
            <View style={[styles.cardHeading, isPhone && styles.cardHeadingPhone]}>
              <View style={styles.cardIcon}><MaterialCommunityIcons name="cloud-sync-outline" size={26} color={colors.accent} /></View>
              <View style={[styles.cardHeadingCopy, isPhone && styles.centeredCopy]}>
                <Text style={[styles.cardTitle, isPhone && styles.textCenter]}>Seus dados, do seu jeito</Text>
                <Text style={[styles.cardDescription, isPhone && styles.textCenter]}>O treino continua disponível no iPhone, mesmo quando você estiver sem conexão.</Text>
              </View>
            </View>

            {!isSupabaseConfigured ? (
              <LocalModePanel />
            ) : session ? (
              <SignedInPanel
                email={session.user.email ?? 'Conta conectada'}
                lastSyncedAt={syncStatus.lastSyncedAt}
                pending={syncStatus.pendingChanges}
                error={syncStatus.error}
                onSync={() => void syncNow()}
                onSignOut={() => void authSignOut()}
                onDeleteAccount={() => void deleteAccount()}
                deletingAccount={deleteAccountBusy}
                deleteAccountError={deleteAccountError}
              />
            ) : (
              <View style={styles.authBlock}>
                <View style={styles.modeRow}>
                  <ChoiceChip label="Entrar" selected={mode === 'signin'} onPress={() => setMode('signin')} />
                  <ChoiceChip label="Criar conta" selected={mode === 'signup'} onPress={() => setMode('signup')} />
                </View>
                <Field
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="voce@exemplo.com"
                />
                <Field
                  label="Senha"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Mínimo de 6 caracteres"
                  onSubmitEditing={() => void submitAuth()}
                />
                {authMessage ? <Text style={[styles.authMessage, authMessage.includes('Não') && styles.errorText]}>{authMessage}</Text> : null}
                <AppButton
                  label={mode === 'signin' ? 'Entrar e sincronizar' : 'Criar conta'}
                  icon={mode === 'signin' ? 'login' : 'account-plus-outline'}
                  onPress={() => void submitAuth()}
                  disabled={!email.trim() || password.length < 6}
                  loading={authBusy}
                  fullWidth
                />
                <Text style={styles.privacyText}>Cada conta só pode acessar os próprios treinos.</Text>
              </View>
            )}
          </Card>

          <Card style={styles.sideCard}>
            <SectionHeader title="Como funciona" />
            {isSupabaseConfigured ? (
              <>
                <Step number="1" title="Crie ou entre na conta" text="Use o mesmo e-mail e senha em cada aparelho." centered={isPhone} />
                <Step number="2" title="Treine normalmente" text="Sem internet, os dados continuam salvos localmente." centered={isPhone} />
                <Step number="3" title="Sincronização automática" text="Ao reconectar, as mudanças são conciliadas e aparecem nos outros aparelhos." centered={isPhone} />
              </>
            ) : (
              <>
                <Step number="1" title="Tudo salvo no iPhone" text="Crie e registre seus treinos normalmente, sem depender de internet." centered={isPhone} />
                <Step number="2" title="Pronto para o seu ritmo" text="Os alertas e o descanso continuam funcionando durante o treino." centered={isPhone} />
                <Step number="3" title="Editor web complementar" text="Ao conectar uma conta, você poderá organizar a ficha no computador e continuar pelo iPhone." centered={isPhone} />
              </>
            )}
          </Card>
        </View>

        <SectionHeader title="Preferências" />
        <Card style={styles.preferencesCard}>
          <ToggleRow
            icon="volume-high"
            label="Som ao terminar o descanso"
            description="Toca um alerta quando a contagem chegar a zero."
            value={data.preferences.soundEnabled}
            onValueChange={(soundEnabled) => updatePreferences({ soundEnabled })}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="vibrate"
            label="Vibração"
            description="Feedback háptico quando disponível no aparelho."
            value={data.preferences.vibrationEnabled}
            onValueChange={(vibrationEnabled) => updatePreferences({ vibrationEnabled })}
          />
          <View style={styles.divider} />
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Descanso padrão</Text>
              <Text style={styles.preferenceText}>Usado como valor inicial ao adicionar exercícios.</Text>
            </View>
            <View style={styles.numberWrap}>
              <NumberControl
                label="Segundos"
                value={data.preferences.defaultRestSeconds}
                onChange={(defaultRestSeconds) => updatePreferences({ defaultRestSeconds })}
                min={0}
                max={1800}
                step={15}
                suffix="s"
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Unidade de peso</Text>
              <Text style={styles.preferenceText}>A unidade fica sincronizada com sua conta.</Text>
            </View>
            <View style={styles.modeRow}>
              <ChoiceChip label="kg" selected={data.preferences.weightUnit === 'kg'} onPress={() => updatePreferences({ weightUnit: 'kg' })} />
              <ChoiceChip label="lb" selected={data.preferences.weightUnit === 'lb'} onPress={() => updatePreferences({ weightUnit: 'lb' })} />
            </View>
          </View>
        </Card>

        <SectionHeader title="Privacidade" />
        <Card style={styles.privacyCard}>
          <View style={styles.privacyCardCopy}>
            <View style={styles.privacyIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.accent} /></View>
            <View style={styles.privacyCardText}>
              <Text style={styles.preferenceTitle}>Sua privacidade</Text>
              <Text style={styles.preferenceText}>Veja como seus dados ficam no iPhone e o que muda quando você usa a sincronização.</Text>
            </View>
          </View>
          <AppButton label="Política de privacidade" icon="shield-account-outline" variant="secondary" fullWidth onPress={() => setPrivacyVisible(true)} />
        </Card>

        {Platform.OS !== 'web' ? (
          <>
            <SectionHeader title="Alertas no iPhone" />
            <Card style={styles.limitationsCard}>
              {REST_ALERT_LIMITATIONS.map((limitation) => (
                <View key={limitation} style={styles.limitationRow}>
                  <MaterialCommunityIcons name="information-outline" color={colors.warning} size={18} />
                  <Text style={styles.limitationText}>{limitation}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <PrivacyPolicyModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
        onlineUrl={onlinePrivacyPolicyUrl}
        supportEmail={supportEmail}
      />
    </View>
  );
}

function LocalModePanel() {
  const { isPhone } = useResponsiveLayout();

  return (
    <View style={[styles.localModeBox, isPhone && styles.localModeBoxPhone]}>
      <MaterialCommunityIcons name="cellphone-check" color={colors.accent} size={28} />
      <View style={[styles.localModeCopy, isPhone && styles.centeredCopy]}>
        <Text style={[styles.localModeTitle, isPhone && styles.textCenter]}>Modo local ativo</Text>
        <Text style={[styles.localModeText, isPhone && styles.textCenter]}>Seus treinos estão salvos neste iPhone e funcionam sem internet. Quando você conectar uma conta, o editor web poderá complementar o planejamento no computador.</Text>
      </View>
    </View>
  );
}

function SignedInPanel({
  email,
  lastSyncedAt,
  pending,
  error,
  onSync,
  onSignOut,
  onDeleteAccount,
  deletingAccount,
  deleteAccountError,
}: {
  email: string;
  lastSyncedAt: string | null;
  pending: boolean;
  error: string | null;
  onSync: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  deletingAccount: boolean;
  deleteAccountError: string | null;
}) {
  return (
    <View style={styles.signedInPanel}>
      <View style={styles.accountRow}>
        <View style={styles.avatar}><MaterialCommunityIcons name="account" size={26} color={colors.black} /></View>
        <View style={styles.accountCopy}><Text style={styles.accountEmail}>{email}</Text><Text style={styles.accountStatus}>{pending ? 'Há alterações aguardando envio' : lastSyncedAt ? `Sincronizado em ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSyncedAt))}` : 'Pronto para sincronizar'}</Text></View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.accountActions}>
        <AppButton label="Sincronizar agora" icon="sync" onPress={onSync} />
        <AppButton label="Sair da conta" icon="logout" variant="ghost" onPress={onSignOut} />
      </View>
      <View style={styles.deleteAccountZone}>
        <View style={styles.deleteAccountCopy}>
          <Text style={styles.deleteAccountTitle}>Excluir minha conta</Text>
          <Text style={styles.deleteAccountText}>Remove permanentemente a conta e os dados sincronizados. Não pode ser desfeito.</Text>
        </View>
        {deleteAccountError ? <Text style={styles.errorText}>{deleteAccountError}</Text> : null}
        <AppButton label="Excluir minha conta" icon="delete-forever-outline" variant="danger" fullWidth onPress={onDeleteAccount} loading={deletingAccount} />
      </View>
    </View>
  );
}

function PrivacyPolicyModal({
  visible,
  onClose,
  onlineUrl,
  supportEmail,
}: {
  visible: boolean;
  onClose: () => void;
  onlineUrl: string | null;
  supportEmail: string | null;
}) {
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const openOnlinePolicy = async () => {
    if (!onlineUrl) return;
    setOnlineError(null);
    try {
      await Linking.openURL(onlineUrl);
    } catch {
      setOnlineError('Não foi possível abrir a versão online agora.');
    }
  };

  return (
    <AdaptiveModal
      visible={visible}
      onRequestClose={onClose}
      title="Política de privacidade"
      maxWidth={680}
      footer={<AppButton label="Fechar" variant="secondary" fullWidth onPress={onClose} />}
    >
      <View style={styles.privacyModalIntro}>
        <View style={styles.privacyModalIcon}><MaterialCommunityIcons name="shield-check-outline" size={28} color={colors.accent} /></View>
        <View style={styles.privacyModalIntroCopy}>
          <Text style={styles.privacyModalTitle}>Seu treino é seu</Text>
          <Text style={styles.privacyModalLead}>Esta política explica, em linguagem simples, como o MeuTreino trata seus dados.</Text>
          <Text style={styles.privacyModalDate}>Atualizada em 1 de setembro de 2026.</Text>
        </View>
      </View>

      <PrivacyItem title="Modo local">
        Seus treinos, histórico e preferências ficam armazenados neste aparelho. Você pode usar o app sem criar uma conta e sem internet.
      </PrivacyItem>
      <PrivacyItem title="Quando você escolhe sincronizar">
        Para autenticar e sincronizar entre o iPhone e o editor web, são usados seu e-mail, um identificador interno da conta e os dados de treino que você registra: exercícios, séries, repetições, tempos de descanso, histórico, preferências e observações. Esses dados são armazenados no Supabase.
      </PrivacyItem>
      <PrivacyItem title="Finalidade">
        Usamos esses dados apenas para criar e proteger sua conta, sincronizar seus treinos e permitir que você veja e edite sua própria ficha em seus aparelhos.
      </PrivacyItem>
      <PrivacyItem title="Prestador de serviço">
        O Supabase presta os serviços de autenticação, banco de dados e sincronização. Ele processa os dados para fornecer essas funções e deve aplicar proteção compatível com esta política e com as obrigações legais pertinentes.
      </PrivacyItem>
      <PrivacyItem title="Sem venda, anúncios ou rastreamento">
        O MeuTreino não vende seus dados, não exibe anúncios e não usa seus dados de treino para rastrear você em outros apps ou sites.
      </PrivacyItem>
      <PrivacyItem title="Retenção e exclusão">
        Os dados sincronizados permanecem na sua conta até que você escolha excluí-la. Com uma conta conectada, use “Excluir minha conta” nesta tela para remover permanentemente a conta e os dados associados.
      </PrivacyItem>
      <PrivacyItem title="Segurança e seus direitos">
        O acesso é protegido pela sua conta e cada pessoa só deve acessar seus próprios dados. Você pode pedir acesso, correção, exportação ou exclusão dos seus dados pelo canal de contato abaixo.
      </PrivacyItem>
      <PrivacyItem title="Contato">
        {supportEmail
          ? `Para dúvidas ou solicitações de privacidade, fale com ${supportEmail}.`
          : 'Se precisar de ajuda, use o canal de suporte informado pelo responsável por este app.'}
      </PrivacyItem>

      {onlineUrl ? <AppButton label="Abrir versão online" icon="open-in-new" variant="secondary" fullWidth onPress={() => void openOnlinePolicy()} /> : null}
      {onlineError ? <Text style={styles.errorText}>{onlineError}</Text> : null}
    </AdaptiveModal>
  );
}

function PrivacyItem({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.privacyItem}>
      <Text style={styles.privacyItemTitle}>{title}</Text>
      <Text style={styles.privacyItemText}>{children}</Text>
    </View>
  );
}

function Step({ number, title, text, centered = false }: { number: string; title: string; text: string; centered?: boolean }) {
  return (
    <View style={[styles.stepRow, centered && styles.stepRowCentered]}>
      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
      <View style={[styles.stepCopy, centered && styles.centeredCopy]}><Text style={[styles.stepTitle, centered && styles.textCenter]}>{title}</Text><Text style={[styles.stepText, centered && styles.textCenter]}>{text}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: spacing.xl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerPhone: { flexDirection: 'column', alignItems: 'center' },
  headerCopy: { flex: 1, gap: 4 },
  centeredCopy: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  twoColumns: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  oneColumn: { flexDirection: 'column' },
  mainCard: { flex: 1.5, gap: spacing.lg },
  sideCard: { flex: 1, gap: spacing.lg },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardHeadingPhone: { flexDirection: 'column', alignItems: 'center' },
  cardIcon: { width: 54, height: 54, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  cardHeadingCopy: { flex: 1, gap: 4 },
  cardTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  cardDescription: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  authBlock: { gap: spacing.md },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  authMessage: { color: colors.success, fontSize: typography.small, lineHeight: 20 },
  errorText: { color: colors.danger, fontSize: typography.small, lineHeight: 20 },
  privacyText: { color: colors.textSubtle, fontSize: typography.caption, lineHeight: 18 },
  localModeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.accentSoft },
  localModeBoxPhone: { flexDirection: 'column', alignItems: 'center' },
  localModeCopy: { flex: 1, gap: spacing.xs },
  localModeTitle: { color: colors.accent, fontSize: typography.body, fontWeight: '900' },
  localModeText: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  signedInPanel: { gap: spacing.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.backgroundRaised },
  avatar: { width: 50, height: 50, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  accountCopy: { flex: 1, gap: 3 },
  accountEmail: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  accountStatus: { color: colors.textMuted, fontSize: typography.caption },
  accountActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  deleteAccountZone: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  deleteAccountCopy: { gap: 3 },
  deleteAccountTitle: { color: colors.danger, fontSize: typography.small, fontWeight: '900' },
  deleteAccountText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepRowCentered: { flexDirection: 'column', alignItems: 'center' },
  stepNumber: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  stepNumberText: { color: colors.accent, fontSize: typography.small, fontWeight: '900' },
  stepCopy: { flex: 1, gap: 3 },
  stepTitle: { color: colors.text, fontSize: typography.small, fontWeight: '800' },
  stepText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
  preferencesCard: { gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.borderSoft },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg, paddingVertical: spacing.xs },
  preferenceCopy: { flex: 1, minWidth: 210, gap: 3 },
  preferenceTitle: { color: colors.text, fontSize: typography.small, fontWeight: '800' },
  preferenceText: { color: colors.textMuted, fontSize: typography.caption, lineHeight: 18 },
  numberWrap: { width: 190 },
  privacyCard: { gap: spacing.md },
  privacyCardCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  privacyIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  privacyCardText: { flex: 1, gap: 3 },
  privacyModalIntro: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
  privacyModalIcon: { width: 54, height: 54, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundRaised },
  privacyModalIntroCopy: { flex: 1, gap: 3 },
  privacyModalTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '900' },
  privacyModalLead: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
  privacyModalDate: { color: colors.textSubtle, fontSize: typography.caption, lineHeight: 18 },
  privacyItem: { gap: 4 },
  privacyItemTitle: { color: colors.text, fontSize: typography.body, fontWeight: '800' },
  privacyItemText: { color: colors.textMuted, fontSize: typography.small, lineHeight: 21 },
  limitationsCard: { gap: spacing.sm },
  limitationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  limitationText: { flex: 1, color: colors.textMuted, fontSize: typography.small, lineHeight: 20 },
});
