import type { Product, Variant } from './types';

export type ProductSelection = {
  options: Record<string, string>;
  image: string;
  quantity: number;
};

export function colourKey(product: Product) {
  return Object.keys(Object.assign({}, ...product.variants.map((v) => v.attributes))).find((key) =>
    /^colou?r$/i.test(key),
  );
}

export function variantImage(product: Product, variant?: Variant) {
  const key = colourKey(product);
  const colourImage =
    key && variant?.attributes[key]
      ? product.variants.find((v) => v.attributes[key] === variant.attributes[key] && v.image)
          ?.image
      : null;
  return variant?.image || colourImage || product.images[0] || '/images/placeholder.svg';
}

export function initialSelection(product: Product): ProductSelection {
  const image = variantImage(product);
  const key = colourKey(product);
  const pictured = product.variants.find((v) => v.image === image);
  const colours = new Set(product.variants.map((v) => key && v.attributes[key]));
  // Legacy single-colour products need no mapping. Never guess among unmapped colours.
  const colour = key && (pictured?.attributes[key] || (colours.size === 1 && [...colours][0]));
  return { options: key && colour ? { [key]: colour } : {}, image, quantity: 1 };
}

export function selectOption(
  product: Product,
  current: ProductSelection,
  key: string,
  value: string,
): ProductSelection {
  const options = { ...current.options, [key]: value };
  if (key === colourKey(product)) {
    // A size from the previous colour must not prevent browsing another colour.
    let candidates = product.variants.filter((v) => v.attributes[key] === value && v.stock > 0);
    for (const other of Object.keys(options).filter((k) => k !== key)) {
      const compatible = candidates.filter((v) => v.attributes[other] === options[other]);
      if (compatible.length) candidates = compatible;
      else delete options[other];
    }
  }
  const matching = product.variants.filter((v) =>
    Object.entries(options).every(([k, val]) => v.attributes[k] === val),
  );
  const pictured = matching.find((v) => v.image) || matching[0];
  return { options, image: variantImage(product, pictured), quantity: 1 };
}

export function selectPhotograph(product: Product, current: ProductSelection, image: string) {
  const key = colourKey(product);
  const pictured = product.variants.find((v) => v.image === image);
  const next =
    key && pictured?.attributes[key]
      ? selectOption(product, current, key, pictured.attributes[key])
      : current;
  return { ...next, image };
}
