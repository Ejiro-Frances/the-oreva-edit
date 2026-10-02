'use client';
import type { Product } from '@/features/catalogue/types';
import { useShopping } from '@/features/cart/provider';
import { ProductCard } from '@/features/catalogue/product-card';
import { EmptyState } from '@/components/ui/empty-state';
export function Wishlist({ products }: { products: Product[] }) {
  const { wishlist, ready } = useShopping();
  const saved = products.filter((p) => wishlist.includes(p.id));
  return !ready ? (
    <p role="status">Finding your favourites…</p>
  ) : saved.length ? (
    <div className="product-grid" style={{ paddingBottom: 70 }}>
      {saved.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  ) : (
    <EmptyState
      title="Keep the good ones close."
      description="Save the pieces that catch your eye. They’ll be waiting here when you’re ready."
    />
  );
}
