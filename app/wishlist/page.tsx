import { Wishlist } from '@/features/wishlist/wishlist';
import { getProducts } from '@/features/catalogue/repository';
export const metadata = { title: 'Your wishlist', robots: { index: false, follow: false } };
export default async function Page() {
  return (
    <div className="container">
      <div className="page-heading">
        <span className="eyebrow">THE ONES YOU LOVE</span>
        <h1>Your wishlist.</h1>
        <p>For now, for later, for the way you feel.</p>
      </div>
      <Wishlist products={await getProducts()} />
    </div>
  );
}
