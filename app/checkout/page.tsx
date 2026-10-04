import { CheckoutForm } from '@/features/checkout/form';
import { checkoutDefaults } from '@/features/checkout/prefill';
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
  const [addresses, profile] = db
    ? await Promise.all([
        db
          .from('addresses')
          .select('id,label,details')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .then((r) => r.data || []),
        db
          .from('profiles')
          .select('display_name,phone')
          .eq('id', user!.id)
          .maybeSingle()
          .then((r) => r.data),
      ])
    : [[], null];
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
        signedInAs={user?.email}
        defaults={checkoutDefaults({ email: user?.email, profile, address: addresses[0]?.details })}
        addresses={addresses}
        selectedAddress={addresses[0]?.id}
      />
    </div>
  );
}
