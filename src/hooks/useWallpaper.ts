import { useCallback, useEffect, useState } from 'react';

import { loadWallpaper, removeWallpaper, saveWallpaper } from '../lib/database';
import type { WallpaperAsset } from '../types';

export function useWallpaper() {
  const [wallpaper, setWallpaper] = useState<{ asset: WallpaperAsset; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadWallpaper()
      .then((loaded) => {
        if (!cancelled && loaded) setWallpaper({ asset: loaded, url: URL.createObjectURL(loaded.blob) });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o wallpaper.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (wallpaper?.url) URL.revokeObjectURL(wallpaper.url);
  }, [wallpaper?.url]);

  const save = useCallback(async (file: File) => {
    try {
      const saved = await saveWallpaper(file);
      setWallpaper({ asset: saved, url: URL.createObjectURL(saved.blob) });
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível salvar o wallpaper.';
      setError(message);
      throw cause;
    }
  }, []);

  const remove = useCallback(async () => {
    try {
      await removeWallpaper();
      setWallpaper(null);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível remover o wallpaper.';
      setError(message);
      throw cause;
    }
  }, []);

  return { asset: wallpaper?.asset ?? null, url: wallpaper?.url ?? null, loading, error, save, remove };
}
