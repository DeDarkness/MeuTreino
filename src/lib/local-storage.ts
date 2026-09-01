import './sqlite-local-storage-install';

import {
  createEmptyAppData,
  mergeAppData,
  parseAppData,
  type AppData,
} from './app-data';

export const GUEST_OWNER_ID = 'guest';
export const APP_DATA_STORAGE_PREFIX = 'meutreino.app-data.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveLocalAppDataOptions {
  /** UI writes touch the document clock by default; sync writes preserve the merged clock. */
  touchUpdatedAt?: boolean;
  notify?: boolean;
}

export type AppDataUpdater = (current: AppData) => AppData;
export type AppDataListener = (data: AppData) => void;

const memoryFallback = new Map<string, string>();
const listenersByOwner = new Map<string, Set<AppDataListener>>();

const memoryStorage: StorageLike = {
  getItem: (key) => memoryFallback.get(key) ?? null,
  setItem: (key, value) => {
    memoryFallback.set(key, value);
  },
  removeItem: (key) => {
    memoryFallback.delete(key);
  },
};

function resolveLocalStorage(): StorageLike {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (candidate) return candidate;
  } catch {
    // Browsers can deny storage (private mode/policy). The in-memory fallback keeps the app usable.
  }

  return memoryStorage;
}

function safeGetItem(key: string): string | null {
  const inMemory = memoryStorage.getItem(key);
  if (inMemory !== null) return inMemory;

  try {
    return resolveLocalStorage().getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    const storage = resolveLocalStorage();
    storage.setItem(key, value);
    if (storage === memoryStorage) return;
    memoryStorage.removeItem(key);
  } catch {
    memoryStorage.setItem(key, value);
  }
}

function safeRemoveItem(key: string): void {
  try {
    resolveLocalStorage().removeItem(key);
  } catch {
    // The in-memory copy is still removed below.
  }
  memoryStorage.removeItem(key);
}

function normalizeOwnerId(ownerId: string | null | undefined): string {
  const normalized = ownerId?.trim();
  return normalized || GUEST_OWNER_ID;
}

function notifyOwner(ownerId: string, data: AppData): void {
  for (const listener of listenersByOwner.get(ownerId) ?? []) {
    listener(data);
  }
}

export function getAppDataStorageKey(ownerId: string = GUEST_OWNER_ID): string {
  return `${APP_DATA_STORAGE_PREFIX}:${encodeURIComponent(normalizeOwnerId(ownerId))}`;
}

export function isLocalStoragePersistent(): boolean {
  return resolveLocalStorage() !== memoryStorage;
}

/** Returns null when this owner has never stored data on this device. */
export function readStoredAppData(ownerId: string = GUEST_OWNER_ID): AppData | null {
  const normalizedOwnerId = normalizeOwnerId(ownerId);

  try {
    const raw = safeGetItem(getAppDataStorageKey(normalizedOwnerId));
    if (!raw) return null;
    return parseAppData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadLocalAppData(ownerId: string = GUEST_OWNER_ID): AppData {
  return readStoredAppData(ownerId) ?? createEmptyAppData();
}

export function saveLocalAppData(
  data: AppData,
  ownerId: string = GUEST_OWNER_ID,
  options: SaveLocalAppDataOptions = {},
): AppData {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  const touchUpdatedAt = options.touchUpdatedAt ?? true;
  const notify = options.notify ?? true;
  const now = new Date().toISOString();
  const normalized = parseAppData({
    ...data,
    updatedAt: touchUpdatedAt ? now : data.updatedAt,
  });
  const serialized = JSON.stringify(normalized);
  const key = getAppDataStorageKey(normalizedOwnerId);

  if (safeGetItem(key) === serialized) return normalized;
  safeSetItem(key, serialized);

  if (notify) notifyOwner(normalizedOwnerId, normalized);
  return normalized;
}

export function updateLocalAppData(
  updater: AppDataUpdater,
  ownerId: string = GUEST_OWNER_ID,
): AppData {
  const current = loadLocalAppData(ownerId);
  return saveLocalAppData(updater(current), ownerId);
}

export function clearLocalAppData(ownerId: string = GUEST_OWNER_ID): void {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  const key = getAppDataStorageKey(normalizedOwnerId);

  safeRemoveItem(key);

  notifyOwner(normalizedOwnerId, createEmptyAppData());
}

export function subscribeToLocalAppData(
  ownerId: string,
  listener: AppDataListener,
): () => void {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  let listeners = listenersByOwner.get(normalizedOwnerId);
  if (!listeners) {
    listeners = new Set();
    listenersByOwner.set(normalizedOwnerId, listeners);
  }

  listeners.add(listener);
  return () => {
    listeners?.delete(listener);
    if (listeners?.size === 0) listenersByOwner.delete(normalizedOwnerId);
  };
}

/** Moves data created before login into the signed-in user's device-local document. */
export function claimGuestAppData(userId: string): AppData {
  const normalizedUserId = normalizeOwnerId(userId);
  if (normalizedUserId === GUEST_OWNER_ID) return loadLocalAppData(GUEST_OWNER_ID);

  const guest = readStoredAppData(GUEST_OWNER_ID);
  const existing = readStoredAppData(normalizedUserId);
  if (!guest) return existing ?? createEmptyAppData();

  const merged = mergeAppData(existing, guest);
  const saved = saveLocalAppData(merged, normalizedUserId, { touchUpdatedAt: false });

  safeRemoveItem(getAppDataStorageKey(GUEST_OWNER_ID));

  return saved;
}

/** Adapter shared by Supabase Auth and app persistence. */
export const localStorageAdapter: StorageLike = {
  getItem: safeGetItem,
  setItem: safeSetItem,
  removeItem: safeRemoveItem,
};
