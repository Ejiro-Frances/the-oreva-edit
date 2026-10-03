'use client';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { colourKey, variantImage } from './selection';
import type { Product } from './types';

export function VariantPicker({
  product,
  selected,
  onChoose,
}: {
  product: Product;
  selected: Record<string, string>;
  onChoose: (key: string, value: string) => void;
}) {
  const keys = [...new Set(product.variants.flatMap((v) => Object.keys(v.attributes)))];
  const colour = colourKey(product);
  return keys.map((key) => {
    const values = [...new Set(product.variants.map((v) => v.attributes[key]).filter(Boolean))];
    const showPhotos = key === colour && values.length > 1;
    return (
      <fieldset className="variant-group" key={key}>
        <legend>
          {key}
          {selected[key] && ` — ${selected[key]}`}
        </legend>
        <div className={`variant-options${showPhotos ? ' variant-colours' : ''}`}>
          {values.map((value) => {
            const available = product.variants.some(
              (v) =>
                v.attributes[key] === value &&
                v.stock > 0 &&
                (key === colour ||
                  keys
                    .filter((k) => k !== key && selected[k])
                    .every((k) => v.attributes[k] === selected[k])),
            );
            const pictured = product.variants.find((v) => v.attributes[key] === value && v.image);
            return (
              <button
                type="button"
                key={value}
                disabled={!available}
                aria-label={`${key}: ${value}${available ? '' : ' (sold out)'}`}
                aria-pressed={selected[key] === value}
                onClick={() => onChoose(key, value)}
              >
                {showPhotos && pictured && (
                  <Image
                    src={variantImage(product, pictured)}
                    alt=""
                    width={54}
                    height={68}
                    sizes="54px"
                  />
                )}
                <span>{value}</span>
                {showPhotos && selected[key] === value && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  });
}
