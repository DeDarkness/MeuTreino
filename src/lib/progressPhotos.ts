import { validDate } from '../nutrition/engine';

export const PHOTO_POSES = {
  front: 'Frontal', right: 'Lateral direita', left: 'Lateral esquerda', back: 'Posterior',
} as const;
export type PhotoPose = keyof typeof PHOTO_POSES;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export interface ProgressPhoto {
  id: string;
  date: string;
  pose: PhotoPose;
  measurementId?: string;
  notes: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  image: Blob;
  thumbnail: Blob;
}

export function photoMetadata({ image, thumbnail, ...meta }: ProgressPhoto) {
  return { ...meta, mimeType: image.type, fileSize: image.size, thumbnailSize: thumbnail.size };
}

export function validateProgressPhoto(photo: ProgressPhoto) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!photo || typeof photo.id !== 'string' || !uuid.test(photo.id) || !validDate(photo.date)
    || !Object.hasOwn(PHOTO_POSES, photo.pose) || typeof photo.notes !== 'string' || photo.notes.length > 2000
    || (photo.measurementId !== undefined && (typeof photo.measurementId !== 'string' || photo.measurementId.length > 1000))
    || !Number.isInteger(photo.width) || !Number.isInteger(photo.height)
    || photo.width < 1 || photo.height < 1 || photo.width > 1920 || photo.height > 1920
    || !Number.isFinite(Date.parse(photo.createdAt)) || !Number.isFinite(Date.parse(photo.updatedAt))
    || !(photo.image instanceof Blob) || photo.image.type !== 'image/jpeg' || !photo.image.size || photo.image.size > MAX_PHOTO_BYTES
    || !(photo.thumbnail instanceof Blob) || photo.thumbnail.type !== 'image/jpeg' || !photo.thumbnail.size || photo.thumbnail.size > MAX_PHOTO_BYTES) {
    throw new Error('A fotografia ou seus metadados são inválidos.');
  }
  return photo;
}

function renderJpeg(image: HTMLImageElement, maximum: number, quality: number) {
  const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('O navegador não conseguiu preparar a foto.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Não foi possível codificar a foto.'));
      else resolve({ blob, width: canvas.width, height: canvas.height });
      canvas.width = 1;
      canvas.height = 1;
    }, 'image/jpeg', quality);
  });
}

export async function prepareProgressPhoto(file: File) {
  if (!file.size || file.size > 30 * 1024 * 1024 || !/^(image\/(jpeg|png|webp|heic|heif|avif))$/i.test(file.type)
    && !(file.type === '' && /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name))) {
    throw new Error('Escolha uma foto JPEG, PNG, WebP, HEIF ou AVIF com até 30 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const source = new Image();
    source.src = url;
    await source.decode().catch(() => { throw new Error('Este aparelho não abriu o formato da foto. Tente uma imagem JPEG.'); });
    if (source.naturalWidth * source.naturalHeight > 48_000_000) throw new Error('Escolha uma foto de até 48 megapixels.');
    // Canvas re-encodes the oriented pixels and leaves source EXIF and GPS behind.
    const large = await renderJpeg(source, 1920, .88);
    const small = await renderJpeg(source, 320, .8);
    return { image: large.blob, thumbnail: small.blob, width: large.width, height: large.height };
  } finally { URL.revokeObjectURL(url); }
}
