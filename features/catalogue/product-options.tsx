'use client';
import { priceRange } from './price';
import { useState } from 'react';
import { Share2, ShoppingBag } from 'lucide-react';
import { VariantPicker } from './variant-picker';
import { useProductSelection } from './product-selection';
import { useShopping } from '@/features/cart/provider';
import { Quantity } from '@/components/ui/quantity';
import { WishlistButton } from '@/features/wishlist/button';
import { Dialog } from '@/components/ui/dialog';
import { money } from '@/lib/money';
export function ProductOptions() {
  const { add, ready, notify } = useShopping();
  const {
    product,
    options: selected,
    quantity,
    choose: select,
    reset,
    setQuantity,
  } = useProductSelection();
  const [error, setError] = useState('');
  const [guide, setGuide] = useState(false);
  const keys = [...new Set(product.variants.flatMap((v) => Object.keys(v.attributes)))];
  const variant = product.variants.find((v) => keys.every((k) => v.attributes[k] === selected[k]));
  const range = priceRange(product);
  const shownPrice = variant ? (variant.price ?? product.price) : range.min;
  const soldOut = product.variants.every((v) => v.stock < 1);
  function choose(key: string, value: string) {
    select(key, value);
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
      <VariantPicker product={product} selected={selected} onChoose={choose} />
      {variant && (
        <p className="variant-availability" role="status">
          {variant.stock > 0
            ? `${Object.values(variant.attributes).join(' / ')} — available`
            : 'This option is currently sold out.'}
        </p>
      )}
      <div className="option-links">
        {Object.keys(selected).length > 0 && (
          <button
            className="small-button"
            type="button"
            onClick={() => {
              reset();
              setError('');
            }}
          >
            Clear choices
          </button>
        )}
        <button
          className="text-link"
          type="button"
          style={{ background: 'none', borderWidth: '0 0 1px' }}
          onClick={() => setGuide(true)}
        >
          A note on sizing
        </button>
      </div>
      <div className="product-actions">
        <Quantity value={quantity} max={variant?.stock || 1} onChange={setQuantity} />
        <button
          disabled={!ready || soldOut || (variant !== undefined && variant.stock < 1)}
          className="button"
          onClick={() => {
            if (!variant) {
              const missing = keys.filter((key) => !selected[key]).map((key) => key.toLowerCase());
              setError(
                missing.length
                  ? `Choose your ${missing.join(' and ')} before adding to your bag.`
                  : 'This combination is unavailable. Choose another option.',
              );
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
          Please check the product details for measurements. If no measurements are listed, contact
          us before ordering.
        </p>
        <p className="caption">
          Footwear sizes are listed on each product; a number alone does not imply UK, US or EU
          sizing.
        </p>
      </Dialog>
    </>
  );
}
