'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import type { Product } from '@/features/catalogue/types';
import { useShopping } from './provider';
import { Quantity } from '@/components/ui/quantity';
import { money } from '@/lib/money';
export function Bag({
  products,
  compact = false,
  onNavigate,
}: {
  products: Product[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { lines, update, ready } = useShopping();
  const resolved = lines.map((line) => {
    const product = products.find((p) => p.variants.some((v) => v.id === line.variantId));
    return { ...line, product, variant: product?.variants.find((v) => v.id === line.variantId) };
  });
  const subtotal = resolved.reduce(
    (sum, l) => sum + (l.variant?.price ?? l.product?.price ?? 0) * l.quantity,
    0,
  );
  if (!ready) return <p role="status">Opening your bag…</p>;
  if (!lines.length)
    return (
      <div className="empty-state">
        <ShoppingBag size={38} strokeWidth={1} />
        <h2>A little room for something good.</h2>
        <p>Your bag is empty. Find the pieces you’ll reach for again.</p>
        <Link className="button" href="/shop" onClick={onNavigate}>
          Explore the edit <ArrowRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className={compact ? 'bag' : 'bag bag-page'}>
      <div className="bag-lines">
        {resolved.map((l) => (
          <article className="bag-line" key={l.variantId}>
            {l.product && (
              <Link href={`/products/${l.product.slug}`} onClick={onNavigate}>
                <Image src={l.product.images[0]} alt={l.product.alt} width={105} height={140} />
              </Link>
            )}
            <div className="bag-line-body">
              <h3>{l.product?.name || 'Unavailable item'}</h3>
              <p className="muted">{Object.values(l.variant?.attributes || {}).join(' / ')}</p>
              <p>{money(l.variant?.price ?? l.product?.price ?? 0)}</p>
              {(!l.variant || l.quantity > l.variant.stock) && (
                <p className="field-error">This quantity is unavailable. Please update your bag.</p>
              )}
              <div className="bag-line-actions">
                <Quantity
                  value={l.quantity}
                  max={l.variant?.stock || 0}
                  onChange={(q) => update(l.variantId, q)}
                  label={`Quantity of ${l.product?.name || 'unavailable item'}`}
                />
                <button
                  className="icon-button"
                  aria-label={`Remove ${l.product?.name || 'unavailable item'}`}
                  onClick={() => update(l.variantId, 0)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="bag-summary">
        <span className="eyebrow">The details</span>
        <div className="total-row">
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <p className="muted">Delivery is calculated at checkout.</p>
        <Link className="button full" href="/checkout" onClick={onNavigate}>
          Continue to checkout <ArrowRight size={17} />
        </Link>
        {compact && (
          <Link className="text-link" href="/cart" onClick={onNavigate}>
            View your bag
          </Link>
        )}
        <p className="caption">
          Payment is not connected. Checkout creates unpaid test orders only.
        </p>
      </div>
    </div>
  );
}
