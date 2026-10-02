import { accessibleOrder } from '@/features/orders/repository';
import { OrderDetails } from '@/features/orders/order-details';
import Link from 'next/link';
export const metadata = { title: 'Track your order', robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const { number } = await searchParams;
  const order = number ? await accessibleOrder(number.trim().toUpperCase()) : null;
  return (
    <div className="container">
      <div className="content-page">
        <span className="eyebrow">FROM OUR EDIT TO YOURS</span>
        <h1>Follow your order.</h1>
        <p>
          Use the browser where you placed your guest order, or sign in to the account used at
          checkout.
        </p>
        <form className="search-form">
          <label className="sr-only" htmlFor="order-number">
            Order reference
          </label>
          <input
            id="order-number"
            name="number"
            placeholder="ORE-2026-000001"
            defaultValue={number}
            required
            maxLength={30}
          />
          <button className="button">Find order</button>
        </form>
        {number && !order && (
          <p role="alert" className="field-error">
            We couldn’t find an order you can access with that reference.
          </p>
        )}
        {order && <OrderDetails order={order} />}
        <Link className="text-link" href="/account/orders">
          Your account orders
        </Link>
      </div>
    </div>
  );
}
