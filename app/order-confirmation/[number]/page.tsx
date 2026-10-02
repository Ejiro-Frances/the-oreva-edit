import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { accessibleOrder } from '@/features/orders/repository';
import { OrderDetails } from '@/features/orders/order-details';
export const metadata = { title: 'Test order received', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const order = await accessibleOrder((await params).number);
  if (!order) notFound();
  return (
    <div className="container">
      <div className="confirmation">
        <CheckCircle2 size={38} />
        <span className="eyebrow" style={{ marginTop: 20 }}>
          DEVELOPMENT ORDER RECEIVED
        </span>
        <h1>Your test edit is in.</h1>
        <p>
          No money has been collected. This order is a development record and will not be delivered.
        </p>
        <OrderDetails order={order} />
        <p>
          Keep your reference. Guest orders are private to this browser unless you were signed in
          when ordering.
        </p>
        <Link className="button" href="/shop">
          Back to the edit
        </Link>
      </div>
    </div>
  );
}
