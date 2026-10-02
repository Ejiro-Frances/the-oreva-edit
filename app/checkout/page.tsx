import { CheckoutForm } from '@/features/checkout/form';
import { getProducts, getDeliveryZones } from '@/features/catalogue/repository';
import { currentUser, sessionClient } from '@/lib/supabase/server';
export const metadata = { title: 'Checkout', robots: { index: false, follow: false } };
export default async function Page() {
  const [products, zones, user] = await Promise.all([
    getProducts(),
    getDeliveryZones(),
    currentUser(),
  ]);
  const db = user ? await sessionClient() : null;
  const addresses = db
    ? (await db.from('addresses').select('id,label,details').eq('user_id', user!.id)).data || []
    : [];
  return (
    <div className="container">
      <div className="page-heading">
        <span className="eyebrow">A FEW LAST DETAILS</span>
        <h1>Make it yours.</h1>
      </div>
      <CheckoutForm
        products={products}
        zones={zones}
        enabled={process.env.ALLOW_TEST_ORDERS === 'true' || process.env.NODE_ENV !== 'production'}
        email={user?.email}
        addresses={addresses}
      />
    </div>
  );
}
