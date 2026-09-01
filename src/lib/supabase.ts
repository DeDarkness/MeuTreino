import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { localStorageAdapter } from './local-storage';
import type { Database } from './supabase-database';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const rawSupabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

let client: SupabaseClient<Database> | null = null;
let configurationError: string | null = null;

if (rawSupabaseUrl && rawSupabasePublishableKey) {
  try {
    new URL(rawSupabaseUrl);
    client = createClient<Database>(rawSupabaseUrl, rawSupabasePublishableKey, {
      auth: {
        storage: localStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    configurationError =
      error instanceof Error ? error.message : 'Configuração inválida do Supabase.';
  }
}

export const supabase = client;
export const isSupabaseConfigured = supabase !== null;

export const supabaseConfig = Object.freeze({
  url: rawSupabaseUrl,
  publishableKeyPresent: rawSupabasePublishableKey.length > 0,
  isConfigured: isSupabaseConfigured,
  missingVariables: [
    ...(rawSupabaseUrl ? [] : ['EXPO_PUBLIC_SUPABASE_URL']),
    ...(rawSupabasePublishableKey ? [] : ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']),
  ],
  error: configurationError,
});

export interface AuthActionResult {
  ok: boolean;
  configured: boolean;
  user: User | null;
  session: Session | null;
  needsEmailConfirmation: boolean;
  error: string | null;
}

export interface AccountDeletionResult {
  ok: boolean;
  configured: boolean;
  error: string | null;
}

export type AuthStateListener = (event: AuthChangeEvent, session: Session | null) => void;

const unavailableMessage = (): string => {
  if (configurationError) return configurationError;
  return `Supabase não configurado. Defina ${supabaseConfig.missingVariables.join(' e ')}.`;
};

const unavailableAuthResult = (): AuthActionResult => ({
  ok: false,
  configured: false,
  user: null,
  session: null,
  needsEmailConfirmation: false,
  error: unavailableMessage(),
});

const caughtAuthResult = (error: unknown): AuthActionResult => ({
  ok: false,
  configured: true,
  user: null,
  session: null,
  needsEmailConfirmation: false,
  error: error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.',
});

export async function signUpWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  if (!supabase) return unavailableAuthResult();

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    return {
      ok: error === null,
      configured: true,
      user: data.user,
      session: data.session,
      needsEmailConfirmation: error === null && data.user !== null && data.session === null,
      error: error?.message ?? null,
    };
  } catch (error) {
    return caughtAuthResult(error);
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  if (!supabase) return unavailableAuthResult();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return {
      ok: error === null,
      configured: true,
      user: data.user,
      session: data.session,
      needsEmailConfirmation: false,
      error: error?.message ?? null,
    };
  } catch (error) {
    return caughtAuthResult(error);
  }
}

export async function signOut(): Promise<AuthActionResult> {
  if (!supabase) return unavailableAuthResult();

  try {
    const { error } = await supabase.auth.signOut();
    return {
      ok: error === null,
      configured: true,
      user: null,
      session: null,
      needsEmailConfirmation: false,
      error: error?.message ?? null,
    };
  } catch (error) {
    return caughtAuthResult(error);
  }
}

/**
 * Permanently deletes the authenticated account through the server-side Edge
 * Function. The function derives the user id from the verified access token;
 * privileged credentials are never shipped in the app.
 */
export async function deleteAccount(): Promise<AccountDeletionResult> {
  if (!supabase) {
    return { ok: false, configured: false, error: unavailableMessage() };
  }

  try {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>(
      'delete-account',
      { body: {} },
    );

    if (error || data?.ok !== true) {
      // If the server completed the deletion but the response was lost, Auth is
      // the authoritative follow-up check. Only the exact user_not_found code is
      // accepted; transport/session errors must not erase local data.
      const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
      const userCheckCode = userCheckError && 'code' in userCheckError
        ? userCheckError.code
        : null;
      if (!userCheck.user && userCheckCode === 'user_not_found') {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        return { ok: true, configured: true, error: null };
      }

      return {
        ok: false,
        configured: true,
        error: 'Não foi possível excluir a conta agora. Tente novamente em instantes.',
      };
    }

    // The server has already removed the user. This clears the persisted token
    // without depending on a second successful request to the deleted account.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    return { ok: true, configured: true, error: null };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : 'Não foi possível excluir a conta agora.',
    };
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    return error ? null : data.session;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export function onAuthStateChange(listener: AuthStateListener): () => void {
  if (!supabase) return () => undefined;

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    listener(event, session);
  });

  return () => data.subscription.unsubscribe();
}

/**
 * Supabase handles browser visibility itself. Native apps should only refresh tokens
 * while foregrounded; call this once from the app/provider and retain the cleanup.
 */
export function startSupabaseAuthAutoRefresh(): () => void {
  if (!supabase || Platform.OS === 'web') return () => undefined;

  const updateRefreshState = (state: string): void => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  updateRefreshState(AppState.currentState);
  const subscription = AppState.addEventListener('change', updateRefreshState);

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
