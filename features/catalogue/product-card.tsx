import { ArrowUpRight } from 'lucide-react';
import { priceRange } from './price';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from './types';
import { money } from '@/lib/money';
import { WishlistButton } from '@/features/wishlist/button';
import { colourKey, initialSelection } from './selection';
export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const range = priceRange(product);
  const key = colourKey(product);
  const colours = key
    ? new Set(product.variants.map((v) => v.attributes[key]).filter(Boolean))
    : new Set<string>();
  const initialColour = key ? initialSelection(product).options[key] : undefined;
  return (
    <article className="product-card">
      <div className="product-photo">
        <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
          <Image
            src={product.images[0] || '/images/placeholder.svg'}
            alt={product.alt}
            loading={eager ? 'eager' : 'lazy'}
            fill
            sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 24vw"
          />
        </Link>
        {product.tags.includes('new-in') && <span className="product-label">New in</span>}
        <WishlistButton id={product.id} name={product.name} />
        <Link className="quick-view" href={`/products/${product.slug}`}>
          Discover this piece <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="product-meta">
        <p className="product-category">
          {product.category}
          {colours.size > 0 && (
            <>
              {' '}
              <span>·</span> {colours.size > 1 ? `${colours.size} colours` : initialColour}
            </>
          )}
        </p>
        <Link href={`/products/${product.slug}`} className="product-name">
          {product.name}
        </Link>
        <p className="product-price">
          {range.min !== range.max ? 'From ' : ''}
          {money(range.min)}{' '}
          {product.compare_at !== null && product.compare_at > range.min && (
            <del>{money(product.compare_at)}</del>
          )}
        </p>
      </div>
    </article>
  );
}
