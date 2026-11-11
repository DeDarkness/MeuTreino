import { useEffect, useRef } from 'react';

export function ProgressPhotoImage({ blob, alt, loading }: { blob: Blob; alt: string; loading?: 'lazy' }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    const url = URL.createObjectURL(blob);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return <img ref={ref} alt={alt} loading={loading} />;
}
