import { Bag } from '@/features/cart/bag';
import { getProducts } from '@/features/catalogue/repository';
export const metadata = { title: 'Your bag', robots: { index: false, follow: false } };
export default async function Page() {
  return (
    <div className="container">
      <div className="page-heading">
        <span className="eyebrow">THE GOOD FINDS</span>
        <h1>Your shopping bag.</h1>
      </div>
      <Bag products={await getProducts()} />
    </div>
  );
}
