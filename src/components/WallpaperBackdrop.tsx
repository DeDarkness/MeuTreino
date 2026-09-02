import type { WallpaperAsset } from '../types';

export function WallpaperBackdrop({ asset, url }: { asset: WallpaperAsset | null; url: string | null }) {
  if (!asset || !url) return null;

  return (
    <div className="wallpaper-backdrop" aria-hidden="true">
      {asset.kind === 'video' ? (
        <video key={url} src={url} autoPlay loop muted playsInline preload="auto" />
      ) : (
        <img src={url} alt="" />
      )}
      <div className="wallpaper-backdrop__shade" />
    </div>
  );
}

