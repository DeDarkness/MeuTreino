import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { decodeBackup, listProgressPhotos } from './database';
import { MAX_PHOTO_BYTES, photoMetadata, validateProgressPhoto, type ProgressPhoto } from './progressPhotos';
import type { AppState } from '../types';
import { emptyNutrition } from '../nutrition/engine';

const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;
const MAX_STATE_BYTES = 50 * 1024 * 1024;
const SNAPSHOT = 'meutreino.json';
const MANIFEST = 'manifesto.json';
type Metadata = ReturnType<typeof photoMetadata>;
type Manifest = { version: 1; app: 'MeuTreino'; withImages: boolean; photos: Metadata[]; hashes: Record<string, string> };

async function checksum(data: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(data));
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function makeProgressArchive(snapshot: string, withImages: boolean) {
  const photos = await listProgressPhotos();
  const state = strToU8(snapshot);
  if (state.length > MAX_STATE_BYTES) throw new Error('O JSON ultrapassa o limite deste ZIP. Exporte o backup JSON em separado.');
  const photoBytes = withImages ? photos.reduce((sum, photo) => sum + photo.image.size + photo.thumbnail.size, 0) : 0;
  if (state.length + photoBytes > MAX_ARCHIVE_BYTES * .95) throw new Error('As fotos ultrapassam o limite de 150 MB do ZIP. Faça um backup sem imagens e exporte as fotos individualmente.');
  const files: Record<string, Uint8Array> = { [SNAPSHOT]: state };
  if (withImages) for (const photo of photos) {
    files[`fotos/${photo.id}.jpg`] = new Uint8Array(await photo.image.arrayBuffer());
    files[`fotos/${photo.id}-miniatura.jpg`] = new Uint8Array(await photo.thumbnail.arrayBuffer());
  }
  const hashes: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) hashes[name] = await checksum(bytes);
  const manifest: Manifest = { version: 1, app: 'MeuTreino', withImages, photos: photos.map(photoMetadata), hashes };
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));
  const archive = zipSync(files, { level: 0 });
  if (archive.length > MAX_ARCHIVE_BYTES) throw new Error('O ZIP excedeu o limite de 150 MB.');
  return new File([Uint8Array.from(archive)], `MeuTreino-backup-${new Date().toISOString().slice(0, 10)}.zip`, { type: 'application/zip' });
}

export async function readProgressArchive(file: File) {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Use um ZIP do MeuTreino de até 150 MB.');
  let total = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: ({ name, originalSize }) => {
    const json = name === SNAPSHOT || name === MANIFEST;
    const photo = /^fotos\/[0-9a-f-]{36}(?:-miniatura)?\.jpg$/i.test(name);
    total += originalSize;
    if ((!json && !photo) || total > MAX_ARCHIVE_BYTES || originalSize > (photo ? MAX_PHOTO_BYTES : MAX_STATE_BYTES)) {
      throw new Error('O ZIP contém entradas inesperadas ou grandes demais.');
    }
    return true;
  } });
  if (!files[MANIFEST] || !files[SNAPSHOT]) throw new Error('O ZIP não contém um backup MeuTreino.');
  const manifest = JSON.parse(strFromU8(files[MANIFEST])) as Manifest;
  if (manifest?.version !== 1 || manifest.app !== 'MeuTreino' || !Array.isArray(manifest.photos) || typeof manifest.withImages !== 'boolean' || !manifest.hashes) {
    throw new Error('Formato de ZIP incompatível.');
  }
  const entries = Object.keys(files).filter((name) => name !== MANIFEST);
  if (entries.length !== Object.keys(manifest.hashes).length || entries.length !== 1 + (manifest.withImages ? manifest.photos.length * 2 : 0)) {
    throw new Error('Há arquivos ausentes ou extras no backup.');
  }
  for (const name of entries) {
    if (manifest.hashes[name] !== await checksum(files[name])) throw new Error('A verificação de integridade do ZIP falhou.');
  }
  const state = await decodeBackup(strFromU8(files[SNAPSHOT]));
  const photos: ProgressPhoto[] = [];
  const ids = new Set<string>();
  for (const meta of manifest.photos) {
    if (!meta || typeof meta.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(meta.id) || ids.has(meta.id)) throw new Error('Identificadores de foto inválidos ou duplicados.');
    ids.add(meta.id);
    if (!manifest.withImages) continue;
    const { mimeType, fileSize, thumbnailSize, ...props } = meta;
    const image = files[`fotos/${meta.id}.jpg`];
    const thumbnail = files[`fotos/${meta.id}-miniatura.jpg`];
    if (mimeType !== 'image/jpeg' || image?.length !== fileSize || thumbnail?.length !== thumbnailSize
      || image?.[0] !== 0xff || image[1] !== 0xd8 || thumbnail?.[0] !== 0xff || thumbnail[1] !== 0xd8) {
      throw new Error('A fotografia do backup não corresponde ao manifesto.');
    }
    photos.push(validateProgressPhoto({
      ...props,
      image: new Blob([Uint8Array.from(image)], { type: mimeType }),
      thumbnail: new Blob([Uint8Array.from(thumbnail)], { type: mimeType }),
    }));
  }
  return { state, photos, metadataCount: manifest.photos.length };
}

export function mergeProgressArchive(current: AppState, imported: AppState): AppState {
  const merge = <T extends { id: string }>(existing: T[], incoming: T[]) => {
    const byId = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming) if (!byId.has(item.id)) byId.set(item.id, item);
    return [...byId.values()];
  };
  const nutrition = current.nutrition ?? emptyNutrition();
  return {
    ...current,
    plans: merge(current.plans, imported.plans),
    history: merge(current.history, imported.history),
    recoveryItems: merge(current.recoveryItems ?? [], imported.recoveryItems ?? []),
    queuedMissedPlans: [...new Set([...(current.queuedMissedPlans ?? []), ...(imported.queuedMissedPlans ?? [])])],
    nutrition: { ...nutrition, measurements: merge(nutrition.measurements, imported.nutrition?.measurements ?? []) },
  };
}
