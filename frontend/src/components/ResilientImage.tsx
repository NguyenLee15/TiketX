import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className: string;
  fallbackClassName?: string;
  width?: number | string;
  height?: number | string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export function ResilientImage({
  src,
  alt,
  className,
  fallbackClassName,
  width,
  height,
  loading = 'lazy',
  fetchPriority,
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={fallbackClassName ?? `${className} bg-surface-3 flex items-center justify-center text-text-tertiary`}>
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  return <img src={src} alt={alt} width={width} height={height} loading={loading} fetchPriority={fetchPriority} onError={() => setFailed(true)} className={className} />;
}
