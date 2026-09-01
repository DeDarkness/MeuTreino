import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import {
  areAppDataEqual,
  createEmptyAppData,
  mergeAppData,
  parseAppData,
  type AppData,
} from './app-data';
import {
  claimGuestAppData,
  loadLocalAppData,
  readStoredAppData,
  saveLocalAppData,
  subscribeToLocalAppData,
} from './local-storage';
import type { Json, UserAppStateRow } from './supabase-database';
import {
  getCurrentSession,
  isSupabaseConfigured,
  onAuthStateChange,
  startSupabaseAuthAutoRefresh,
  supabase,
} from './supabase';

export type SyncPhase =
  | 'disabled'
  | 'signed-out'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  configured: boolean;
  userId: string | null;
  pendingChanges: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface SyncResult {
  ok: boolean;
  data: AppData;
  status: SyncStatus;
}

export type SyncStatusListener = (status: SyncStatus) => void;

export interface AppDataSyncController {
  start(): Promise<void>;
  stop(): Promise<void>;
  syncNow(): Promise<SyncResult>;
  getStatus(): SyncStatus;
  subscribe(listener: SyncStatusListener): () => void;
}

interface ErrorWithCode {
  code?: string;
  message?: string;
  details?: string;
}

const MAX_COMMIT_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 30_000;

const toJson = (data: AppData): Json => data as unknown as Json;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as ErrorWithCode;
    return candidate.message ?? candidate.details ?? 'Falha desconhecida na sincronização.';
  }
  return 'Falha desconhecida na sincronização.';
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as ErrorWithCode).code === '23505';

const isNetworkFailure = (message: string): boolean =>
  /network|fetch|offline|timeout|connection|socket/i.test(message);

const nextTick = (callback: () => void): void => {
  Promise.resolve().then(callback).catch(() => undefined);
};

export function createAppDataSync(): AppDataSyncController {
  let status: SyncStatus = {
    phase: isSupabaseConfigured ? 'idle' : 'disabled',
    configured: isSupabaseConfigured,
    userId: null,
    pendingChanges: false,
    lastSyncedAt: null,
    error: null,
  };
  let started = false;
  let lifecycleEpoch = 0;
  let bindEpoch = 0;
  let activeUserId: string | null = null;
  let channel: RealtimeChannel | null = null;
  let authCleanup: (() => void) | null = null;
  let authRefreshCleanup: (() => void) | null = null;
  let localCleanup: (() => void) | null = null;
  let foregroundCleanup: (() => void) | null = null;
  let onlineCleanup: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  let suppressLocalScheduling = false;
  let rerunRequested = false;
  let inFlight: Promise<SyncResult> | null = null;
  const listeners = new Set<SyncStatusListener>();

  const getStatus = (): SyncStatus => ({ ...status });

  const setStatus = (patch: Partial<SyncStatus>): void => {
    status = { ...status, ...patch };
    const snapshot = getStatus();
    for (const listener of listeners) listener(snapshot);
  };

  const clearRetry = (): void => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const scheduleSync = (delayMs = 0): void => {
    if (!started || !activeUserId || !supabase) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void syncNow();
    }, delayMs);
  };

  const scheduleRetry = (): void => {
    retryCount += 1;
    const delay = Math.min(1_000 * 2 ** Math.min(retryCount - 1, 5), MAX_RETRY_DELAY_MS);
    scheduleSync(delay);
  };

  const saveReconciledData = (
    userId: string,
    serverData: AppData,
  ): { data: AppData; needsAnotherCommit: boolean } => {
    const currentLocal = readStoredAppData(userId);
    const reconciled = mergeAppData(currentLocal, serverData);

    suppressLocalScheduling = true;
    try {
      saveLocalAppData(reconciled, userId, { touchUpdatedAt: false });
    } finally {
      suppressLocalScheduling = false;
    }

    return {
      data: reconciled,
      needsAnotherCommit: !areAppDataEqual(reconciled, serverData),
    };
  };

  const fetchRemoteRow = async (userId: string): Promise<UserAppStateRow | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('user_app_state')
      .select('user_id,data,revision,updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const reconcileWithServer = async (userId: string): Promise<AppData> => {
    if (!supabase) return loadLocalAppData(userId);

    for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
      const remoteRow = await fetchRemoteRow(userId);
      const localAtStart = readStoredAppData(userId);
      const remoteData = remoteRow ? parseAppData(remoteRow.data) : null;
      const merged = mergeAppData(localAtStart, remoteData);

      if (!remoteRow) {
        const { data: inserted, error } = await supabase
          .from('user_app_state')
          .insert({ user_id: userId, data: toJson(merged) })
          .select('user_id,data,revision,updated_at')
          .single();

        if (error && isUniqueViolation(error)) continue;
        if (error) throw error;

        const serverData = parseAppData(inserted.data);
        const reconciliation = saveReconciledData(userId, serverData);
        if (reconciliation.needsAnotherCommit) rerunRequested = true;
        return reconciliation.data;
      }

      if (areAppDataEqual(merged, remoteData ?? createEmptyAppData())) {
        const reconciliation = saveReconciledData(userId, merged);
        if (reconciliation.needsAnotherCommit) rerunRequested = true;
        return reconciliation.data;
      }

      const { data: updated, error } = await supabase
        .from('user_app_state')
        .update({ data: toJson(merged) })
        .eq('user_id', userId)
        .eq('revision', remoteRow.revision)
        .select('user_id,data,revision,updated_at')
        .maybeSingle();

      if (error) throw error;
      if (!updated) continue;

      const serverData = parseAppData(updated.data);
      const reconciliation = saveReconciledData(userId, serverData);
      if (reconciliation.needsAnotherCommit) rerunRequested = true;
      return reconciliation.data;
    }

    throw new Error('O estado mudou em outro dispositivo. A sincronização será tentada novamente.');
  };

  const performSync = async (): Promise<SyncResult> => {
    if (!supabase || !isSupabaseConfigured) {
      setStatus({ phase: 'disabled', configured: false, error: null });
      return { ok: false, data: loadLocalAppData(), status: getStatus() };
    }

    if (!activeUserId) {
      setStatus({ phase: 'signed-out', userId: null, error: null });
      return { ok: false, data: loadLocalAppData(), status: getStatus() };
    }

    const syncingUserId = activeUserId;
    setStatus({
      phase: 'syncing',
      userId: syncingUserId,
      pendingChanges: true,
      error: null,
    });

    try {
      const data = await reconcileWithServer(syncingUserId);
      if (activeUserId !== syncingUserId) {
        return { ok: false, data, status: getStatus() };
      }

      retryCount = 0;
      clearRetry();
      setStatus({
        phase: 'synced',
        pendingChanges: rerunRequested,
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });
      return { ok: true, data, status: getStatus() };
    } catch (error) {
      const message = errorMessage(error);
      setStatus({
        phase: isNetworkFailure(message) ? 'offline' : 'error',
        pendingChanges: true,
        error: message,
      });
      scheduleRetry();
      return {
        ok: false,
        data: loadLocalAppData(syncingUserId),
        status: getStatus(),
      };
    }
  };

  const syncNow = async (): Promise<SyncResult> => {
    if (inFlight) {
      rerunRequested = true;
      return inFlight;
    }

    rerunRequested = false;
    inFlight = performSync().finally(() => {
      inFlight = null;
      if (rerunRequested) {
        rerunRequested = false;
        scheduleSync(0);
      }
    });

    return inFlight;
  };

  const removeRealtimeChannel = async (): Promise<void> => {
    if (!channel || !supabase) return;
    const oldChannel = channel;
    channel = null;
    await supabase.removeChannel(oldChannel);
  };

  const setupRealtimeChannel = (userId: string): void => {
    if (!supabase) return;

    channel = supabase
      .channel(`user-app-state:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_app_state',
          filter: `user_id=eq.${userId}`,
        },
        () => scheduleSync(0),
      )
      .subscribe((realtimeStatus) => {
        if (realtimeStatus === 'SUBSCRIBED') {
          scheduleSync(0);
        } else if (realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT') {
          setStatus({ phase: 'offline', error: 'Canal Realtime indisponível.' });
          scheduleRetry();
        }
      });
  };

  const bindUser = async (
    userId: string | null,
    expectedLifecycle = lifecycleEpoch,
  ): Promise<void> => {
    const currentBind = ++bindEpoch;
    if (!started || expectedLifecycle !== lifecycleEpoch) return;

    if (activeUserId === userId && userId !== null) {
      scheduleSync(0);
      return;
    }

    clearRetry();
    localCleanup?.();
    localCleanup = null;
    await removeRealtimeChannel();
    if (
      !started ||
      expectedLifecycle !== lifecycleEpoch ||
      currentBind !== bindEpoch
    ) return;
    activeUserId = userId;

    if (!userId) {
      setStatus({
        phase: 'signed-out',
        userId: null,
        pendingChanges: false,
        error: null,
      });
      return;
    }

    claimGuestAppData(userId);
    localCleanup = subscribeToLocalAppData(userId, () => {
      if (suppressLocalScheduling) return;
      if (inFlight) {
        rerunRequested = true;
        setStatus({ pendingChanges: true, error: null });
        return;
      }
      setStatus({ phase: 'idle', pendingChanges: true, error: null });
      scheduleSync(150);
    });

    setStatus({ phase: 'idle', userId, pendingChanges: false, error: null });
    setupRealtimeChannel(userId);
  };

  const start = async (): Promise<void> => {
    if (started) return;
    started = true;
    const currentLifecycle = ++lifecycleEpoch;

    if (!supabase || !isSupabaseConfigured) {
      setStatus({ phase: 'disabled', configured: false, error: null });
      return;
    }

    authRefreshCleanup = startSupabaseAuthAutoRefresh();
    authCleanup = onAuthStateChange((_event, session) => {
      const eventLifecycle = lifecycleEpoch;
      nextTick(() => {
        void bindUser(session?.user.id ?? null, eventLifecycle);
      });
    });

    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') scheduleSync(0);
      });
      foregroundCleanup = () => subscription.remove();
    } else {
      const eventTarget = globalThis as unknown as {
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
      const handleOnline = (): void => scheduleSync(0);
      eventTarget.addEventListener?.('online', handleOnline);
      onlineCleanup = () => eventTarget.removeEventListener?.('online', handleOnline);
    }

    const session = await getCurrentSession();
    if (!started || currentLifecycle !== lifecycleEpoch) return;
    await bindUser(session?.user.id ?? null, currentLifecycle);
  };

  const stop = async (): Promise<void> => {
    if (!started) return;
    started = false;
    lifecycleEpoch += 1;
    bindEpoch += 1;
    clearRetry();
    authCleanup?.();
    authCleanup = null;
    authRefreshCleanup?.();
    authRefreshCleanup = null;
    localCleanup?.();
    localCleanup = null;
    foregroundCleanup?.();
    foregroundCleanup = null;
    onlineCleanup?.();
    onlineCleanup = null;
    await removeRealtimeChannel();
    activeUserId = null;
    setStatus({ phase: isSupabaseConfigured ? 'idle' : 'disabled', userId: null });
  };

  const subscribe = (listener: SyncStatusListener): (() => void) => {
    listeners.add(listener);
    listener(getStatus());
    return () => listeners.delete(listener);
  };

  return { start, stop, syncNow, getStatus, subscribe };
}

export const appDataSync = createAppDataSync();
