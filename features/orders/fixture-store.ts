import { join, basename } from 'node:path';
import 'server-only';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { products, deliveryZones } from '@/features/catalogue/fixtures';
import { quoteOrder } from '@/features/checkout/pricing';
import type { Order } from './types';
import type { CartLine } from '@/features/catalogue/types';
import type { CheckoutInput } from '@/lib/validation';
import { AppError } from '@/lib/security';
type Store = { orders: Order[]; stock: Record<string, number> };
let queue: Promise<unknown> = Promise.resolve();
const file = join(
  process.cwd(),
  '.data',
  basename(process.env.FIXTURE_ORDER_FILE || 'test-orders.json'),
);
async function read(): Promise<Store> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { orders: [], stock: {} };
  }
}
export async function fixtureOrders() {
  return (await read()).orders;
}
export function createFixtureOrder(
  input: { items: CartLine[]; contact: CheckoutInput; idempotencyKey: string },
  guestHash: string,
  userId: string | null,
): Promise<Order> {
  const operation = queue.then(async () => {
    const store = await read();
    const previous = store.orders.find((o) => o.idempotency_key === input.idempotencyKey);
    if (previous) {
      if (previous.guest_hash !== guestHash || previous.user_id !== userId)
        throw new AppError('Order request conflicts with an existing request', 409);
      return previous;
    }
    const catalogue = products.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, stock: store.stock[v.id] ?? v.stock })),
    }));
    let quote;
    try {
      quote = quoteOrder(input.items, catalogue, deliveryZones, input.contact.state);
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Order cannot be created', 409);
    }
    const order: Order = {
      id: randomUUID(),
      number: `ORE-${new Date().getFullYear()}-${String(store.orders.length + 1).padStart(6, '0')}`,
      user_id: userId,
      guest_hash: guestHash,
      idempotency_key: input.idempotencyKey,
      status: 'pending',
      payment_status: 'unpaid',
      fulfilment_status: 'unfulfilled',
      contact: input.contact,
      subtotal: quote.subtotal,
      delivery: quote.delivery,
      total: quote.total,
      items: quote.lines,
      created_at: new Date().toISOString(),
      test: true,
    };
    for (const l of quote.lines) {
      const v = catalogue.flatMap((p) => p.variants).find((v) => v.id === l.variant_id)!;
      store.stock[l.variant_id] = v.stock - l.quantity;
    }
    store.orders.push(order);
    const { dirname } = await import('node:path');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file + '.tmp', JSON.stringify(store), 'utf8');
    await rename(file + '.tmp', file);
    return order;
  });
  queue = operation.catch(() => undefined);
  return operation;
}
