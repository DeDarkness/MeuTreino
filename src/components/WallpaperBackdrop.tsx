import { useEffect, useRef } from 'react';
import type { WallpaperAsset } from '../types';

export function WallpaperBackdrop({ asset, url, reducedMotion = false }: { asset: WallpaperAsset | null; url: string | null; reducedMotion?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      if (document.visibilityState !== 'visible' || reducedMotion) video.pause();
      else void video.play().catch(() => undefined);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { video.pause(); document.removeEventListener('visibilitychange', sync); };
  }, [url, reducedMotion]);
  if (!asset || !url) return null;

  return (
    <div className="wallpaper-backdrop" aria-hidden="true">
      {asset.kind === 'video' ? (
        <video ref={videoRef} key={url} src={url} autoPlay={!reducedMotion} loop muted playsInline preload="metadata" />
      ) : (
        <img src={url} alt="" hidden={reducedMotion && /\.gif$/i.test(asset.name)} />
      )}
      <div className="wallpaper-backdrop__shade" />
    </div>
  );
}

