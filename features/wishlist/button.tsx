'use client';
import { Heart } from 'lucide-react';
import { useShopping } from '@/features/cart/provider';
export function WishlistButton({
  id,
  name,
  text = false,
}: {
  id: string;
  name: string;
  text?: boolean;
}) {
  const { wishlist, toggle, ready } = useShopping();
  const saved = wishlist.includes(id);
  return (
    <button
      disabled={!ready}
      type="button"
      className={text ? 'button button-outline' : 'wishlist-button'}
      aria-label={`${saved ? 'Remove' : 'Save'} ${name}${saved ? ' from' : ' to'} wishlist`}
      aria-pressed={saved}
      onClick={() => toggle(id)}
    >
      <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
      {text && (saved ? 'Saved to wishlist' : 'Save for later')}
    </button>
  );
}
