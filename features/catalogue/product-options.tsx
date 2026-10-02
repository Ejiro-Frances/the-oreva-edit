'use client';
import { priceRange } from './price';
import { useState } from 'react';
import { Share2, ShoppingBag } from 'lucide-react';
import type { Product } from './types';
import { useShopping } from '@/features/cart/provider';
import { Quantity } from '@/components/ui/quantity';
import { WishlistButton } from '@/features/wishlist/button';
import { Dialog } from '@/components/ui/dialog';
import { money } from '@/lib/money';
export function ProductOptions({ product }: { product: Product }) {
  const { add, ready, notify } = useShopping();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [guide, setGuide] = useState(false);
  const keys = [...new Set(product.variants.flatMap((v) => Object.keys(v.attributes)))];
  const variant = product.variants.find((v) => keys.every((k) => v.attributes[k] === selected[k]));
  const range = priceRange(product);
  const shownPrice = variant ? (variant.price ?? product.price) : range.min;
  const soldOut = product.variants.every((v) => v.stock < 1);
  function choose(key: string, value: string) {
    setSelected((current) => ({ ...current, [key]: value }));
    setQuantity(1);
    setError('');
  }
  return (
    <>
      <p className="detail-price">
        {!variant && range.min !== range.max ? 'From ' : ''}
        {money(shownPrice)}{' '}
        {product.compare_at !== null && product.compare_at > shownPrice && (
          <del>{money(product.compare_at)}</del>
        )}
      </p>
      <p className="product-description">{product.short_description}</p>
      {keys.map((key) => (
        <fieldset className="variant-group" key={key}>
          <legend>
            {key}
            {selected[key] && ` — ${selected[key]}`}
          </legend>
          <div className="variant-options">
            {[...new Set(product.variants.map((v) => v.attributes[key]))].map((value) => {
              const available = product.variants.some(
                (v) =>
                  v.attributes[key] === value &&
                  v.stock > 0 &&
                  keys
                    .filter((k) => k !== key && selected[k])
                    .every((k) => v.attributes[k] === selected[k]),
              );
              return (
                <button
                  type="button"
                  key={value}
                  disabled={!available}
                  aria-label={`${key}: ${value}${available ? '' : ' (sold out)'}`}
                  aria-pressed={selected[key] === value}
                  onClick={() => choose(key, value)}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {Object.keys(selected).length > 0 && (
        <button
          className="small-button"
          type="button"
          onClick={() => {
            setSelected({});
            setQuantity(1);
            setError('');
          }}
        >
          Clear choices
        </button>
      )}
      <button
        className="text-link"
        style={{ background: 'none', borderWidth: '0 0 1px' }}
        onClick={() => setGuide(true)}
      >
        A note on sizing
      </button>
      <div className="product-actions">
        <Quantity value={quantity} max={variant?.stock || 1} onChange={setQuantity} />
        <button
          disabled={!ready || soldOut}
          className="button"
          onClick={() => {
            if (!variant) {
              setError('Choose your colour and size before adding to your bag.');
              return;
            }
            if (!add(variant.id, quantity, variant.stock))
              setError('That quantity is not available. Check the quantity already in your bag.');
          }}
        >
          {soldOut ? 'Currently unavailable' : 'Add to bag'}
          <ShoppingBag size={17} />
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="product-save-row">
        <WishlistButton id={product.id} name={product.name} text />
        <button
          className="text-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              notify('Product link copied');
            } catch {
              notify('Copy the product address from your browser to share it.');
            }
          }}
        >
          Share <Share2 size={14} />
        </button>
      </div>
      <Dialog title="Find your fit" open={guide} onClose={() => setGuide(false)}>
        <p>
          Sizes are specific to each style. The size labels shown here come from this product’s
          catalogue options.
        </p>
        <p className="fixture-notice">
          {product.fixture
            ? 'Development catalogue: verified garment measurements and size conversions have not been supplied. These labels are not a measurement guarantee.'
            : 'Please check the product details for measurements. If no measurements are listed, contact us before ordering.'}
        </p>
        <p className="caption">
          Footwear sizing systems must be confirmed on the individual product; a number alone does
          not imply UK, US or EU sizing.
        </p>
      </Dialog>
    </>
  );
}
