'use client';

import React, { useEffect, useState } from 'react';
import { getCachedClothingImageUrl, getClothingImageUrl } from '@/lib/clothingImages';

type ClothingImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** The item's `image_url` (a storage path, or a legacy public URL). */
  src: string | null | undefined;
};

/** An <img> for a clothing photo stored in the private bucket. */
export default function ClothingImage({ src, alt, ...rest }: ClothingImageProps) {
  const [url, setUrl] = useState<string | null>(() => getCachedClothingImageUrl(src));

  useEffect(() => {
    let cancelled = false;
    getClothingImageUrl(src).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!url) return <span aria-label={alt} role="img" {...(rest as object)} />;
  return <img src={url} alt={alt} {...rest} />;
}
