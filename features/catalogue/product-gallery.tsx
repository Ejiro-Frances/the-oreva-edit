'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  return (
    <div>
      <div className="gallery-main">
        <button aria-label="Enlarge product photograph" onClick={() => setZoom(true)}>
          <Image
            src={images[active] || '/images/placeholder.svg'}
            alt={alt}
            fill
            preload
            sizes="(max-width: 600px) 90vw, 50vw"
          />
        </button>
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((src, i) => (
            <button
              key={src}
              aria-label={`View photograph ${i + 1}`}
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              <Image src={src} alt="" width={65} height={85} />
            </button>
          ))}
        </div>
      )}
      <Dialog title="A closer look" open={zoom} onClose={() => setZoom(false)}>
        <Image
          className="zoom-image"
          src={images[active]}
          alt={alt}
          width={1200}
          height={1600}
          sizes="90vw"
        />
      </Dialog>
    </div>
  );
}
