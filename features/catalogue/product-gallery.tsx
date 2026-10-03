'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { useProductSelection } from './product-selection';
import { colourKey } from './selection';
export function ProductGallery() {
  const { product, options, image, viewImage } = useProductSelection();
  const images = [
    ...new Set([...product.images, ...product.variants.flatMap((v) => (v.image ? [v.image] : []))]),
  ];
  const key = colourKey(product);
  const pictured = product.variants.find((v) => v.image === image);
  const singleColour = new Set(product.variants.map((v) => key && v.attributes[key])).size === 1;
  const colour = key && (pictured?.attributes[key] || (singleColour && options[key]));
  const alt = colour ? `${product.name} in ${colour}` : product.alt;
  const missingPhotograph =
    key &&
    options[key] &&
    !singleColour &&
    !product.variants.some((v) => v.attributes[key] === options[key] && v.image);
  const [zoom, setZoom] = useState(false);
  return (
    <div>
      <div className="gallery-main">
        <button aria-label="Enlarge product photograph" onClick={() => setZoom(true)}>
          <Image src={image} alt={alt} fill preload sizes="(max-width: 600px) 90vw, 50vw" />
        </button>
      </div>
      {missingPhotograph && (
        <p className="caption" role="status">
          A photograph of {options[key]} is not available yet. Showing the main product photograph.
        </p>
      )}
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((src, i) => (
            <button
              key={src}
              aria-label={`View photograph ${i + 1}`}
              aria-pressed={image === src}
              onClick={() => viewImage(src)}
            >
              <Image src={src} alt="" width={65} height={85} />
            </button>
          ))}
        </div>
      )}
      <Dialog title="A closer look" open={zoom} onClose={() => setZoom(false)}>
        <Image
          className="zoom-image"
          src={image}
          alt={alt}
          width={1200}
          height={1600}
          sizes="90vw"
        />
      </Dialog>
    </div>
  );
}
