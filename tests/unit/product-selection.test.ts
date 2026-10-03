import { describe, it, expect } from 'vitest';
import { products, deliveryZones } from '@/features/catalogue/fixtures';
import { initialSelection, selectOption, selectPhotograph } from '@/features/catalogue/selection';
import { quoteOrder } from '@/features/checkout/pricing';

const shirt = products[1];
describe('photograph and colour selection', () => {
  it('selects the pictured colour independently of variant ordering and leaves size open', () => {
    const product = { ...shirt, variants: [...shirt.variants].reverse() };
    expect(initialSelection(product)).toEqual({
      options: { Colour: 'Stone' },
      image: '/images/shirt.jpg',
      quantity: 1,
    });
    expect(initialSelection({ ...product, images: ['/images/shirt-sage.webp'] }).options).toEqual({
      Colour: 'Sage',
    });
  });
  it('supports legacy single-colour products without guessing between unmapped colours', () => {
    const unmapped = shirt.variants.map((v) => ({ ...v, image: null }));
    expect(initialSelection({ ...shirt, variants: unmapped }).options).toEqual({});
    expect(
      initialSelection({
        ...shirt,
        variants: unmapped.filter((v) => v.attributes.Colour === 'Stone'),
      }).options,
    ).toEqual({ Colour: 'Stone' });
  });
  it('keeps a compatible size but resets quantity when changing colours', () => {
    const current = {
      options: { Colour: 'Stone', Size: 'M' },
      image: '/images/shirt.jpg',
      quantity: 5,
    };
    expect(selectOption(shirt, current, 'Colour', 'Sage')).toEqual({
      options: { Colour: 'Sage', Size: 'M' },
      image: '/images/shirt-sage.webp',
      quantity: 1,
    });
  });
  it('clears a size that is sold out in the new colour', () => {
    const product = {
      ...shirt,
      variants: shirt.variants.map((v) =>
        v.attributes.Colour === 'Sage' && v.attributes.Size === 'M' ? { ...v, stock: 0 } : v,
      ),
    };
    const current = {
      options: { Colour: 'Stone', Size: 'M' },
      image: '/images/shirt.jpg',
      quantity: 1,
    };
    expect(selectOption(product, current, 'Colour', 'Sage').options).toEqual({ Colour: 'Sage' });
  });
  it('selects the colour represented by a gallery thumbnail', () => {
    expect(
      selectPhotograph(shirt, initialSelection(shirt), '/images/shirt-dusty-blue.webp').options,
    ).toEqual({ Colour: 'Dusty blue' });
  });
  it('handles a product without variants or photographs', () => {
    expect(initialSelection({ ...shirt, variants: [], images: [] })).toEqual({
      options: {},
      image: '/images/placeholder.svg',
      quantity: 1,
    });
  });
  it('snapshots the chosen colour photograph in a fixture order', () => {
    const variant = shirt.variants.find((v) => v.attributes.Colour === 'Sage')!;
    const quote = quoteOrder(
      [{ variantId: variant.id, quantity: 1 }],
      products,
      deliveryZones,
      'Lagos',
    );
    expect(quote.lines[0].image).toBe('/images/shirt-sage.webp');
    expect(quote.lines[0].attributes.Colour).toBe('Sage');
  });
});
