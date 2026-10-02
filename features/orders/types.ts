import type { CheckoutInput } from '@/lib/validation';
export type OrderLine = {
  variant_id: string;
  product_id: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  image: string;
  price: number;
  quantity: number;
  discount: number;
};
export type Order = {
  id: string;
  number: string;
  user_id: string | null;
  guest_hash: string;
  idempotency_key: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  fulfilment_status: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'returned';
  contact: CheckoutInput;
  subtotal: number;
  delivery: number;
  total: number;
  items: OrderLine[];
  created_at: string;
  test: boolean;
};
