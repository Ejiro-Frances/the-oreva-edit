import { priceRange } from '@/features/catalogue/price';
import { describe, it, expect } from 'vitest';
import { money, calculateTotals } from '@/lib/money';
import { checkoutSchema, cartSchema } from '@/lib/validation';
import { quoteOrder } from '@/features/checkout/pricing';
import { products, deliveryZones } from '@/features/catalogue/fixtures';
import { filterProducts } from '@/features/catalogue/filter';
import { mergeCart } from '@/features/cart/merge';
import { canFulfil } from '@/features/orders/status';
import { escapeHtml, orderEmail } from '@/lib/email/template';
const contact = {
  firstName: 'Test',
  lastName: 'Customer',
  email: 'customer@example.test',
  phone: '08012345678',
  state: 'Lagos',
  lga: '',
  city: 'Test City',
  address: '10 Test Street',
  landmark: '',
  instructions: '',
  acceptTest: true,
};
describe('money and order pricing', () => {
  it('formats NGN from integer kobo', () => {
    expect(money(3850000)).toBe('₦38,500');
    expect(money(12345)).toBe('₦123.45');
  });
  it('calculates subtotal and delivery without float arithmetic', () =>
    expect(calculateTotals([{ price: 1999, quantity: 3 }], 500)).toEqual({
      subtotal: 5997,
      delivery: 500,
      total: 6497,
    }));
  it.each([0, -1, 1.2, 21, NaN])('rejects quantity %s', (quantity) =>
    expect(() => calculateTotals([{ price: 100, quantity }])).toThrow(),
  );
  it('rejects negative prices', () =>
    expect(() => calculateTotals([{ price: -1, quantity: 1 }])).toThrow());
  it('uses catalogue price and delivery rate', () => {
    const quote = quoteOrder(
      [{ variantId: products[0].variants[0].id, quantity: 2 }],
      products,
      deliveryZones,
      'Lagos',
    );
    expect(quote.total).toBe(7950000);
    expect(quote.lines[0].sku).toBe(products[0].variants[0].sku);
  });
  it('rejects sold-out, nonexistent and duplicate variants', () => {
    const id = products[0].variants[0].id;
    expect(() =>
      quoteOrder(
        [{ variantId: products[0].variants[3].id, quantity: 1 }],
        products,
        deliveryZones,
        'Lagos',
      ),
    ).toThrow('unavailable');
    expect(() =>
      quoteOrder([{ variantId: 'missing', quantity: 1 }], products, deliveryZones, 'Lagos'),
    ).toThrow('no longer');
    expect(() =>
      quoteOrder(
        [
          { variantId: id, quantity: 1 },
          { variantId: id, quantity: 1 },
        ],
        products,
        deliveryZones,
        'Lagos',
      ),
    ).toThrow('Duplicate');
  });
  it('does not invent delivery coverage', () =>
    expect(() =>
      quoteOrder(
        [{ variantId: products[0].variants[0].id, quantity: 1 }],
        products,
        deliveryZones,
        'Kano',
      ),
    ).toThrow('not available'));
  it('applies a configured free-delivery threshold', () => {
    const quote = quoteOrder(
      [{ variantId: products[0].variants[0].id, quantity: 1 }],
      products,
      [{ ...deliveryZones[0], free_threshold: 1000000 }],
      'Lagos',
    );
    expect(quote.delivery).toBe(0);
  });
});
describe('input validation', () => {
  it('accepts Nigerian local and international numbers', () => {
    expect(checkoutSchema.safeParse(contact).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...contact, phone: '+2348012345678' }).success).toBe(true);
  });
  it.each([
    { email: 'invalid' },
    { phone: '555' },
    { state: 'California' },
    { acceptTest: false },
    { address: 'x' },
  ])('rejects invalid checkout %o', (change) =>
    expect(checkoutSchema.safeParse({ ...contact, ...change }).success).toBe(false),
  );
  it('rejects client quantities beyond the cap', () =>
    expect(
      cartSchema.safeParse([{ variantId: products[0].variants[0].id, quantity: 100 }]).success,
    ).toBe(false));
});
describe('catalogue and cart', () => {
  it('searches actual names and categories', () => {
    expect(filterProducts(products, { q: 'linen' }).map((p) => p.slug)).toEqual([
      'everyday-linen-shirt',
    ]);
    expect(filterProducts(products, { q: 'not-a-real-piece' })).toHaveLength(0);
  });
  it('filters available sizes and sorts prices', () => {
    const result = filterProducts(products, {
      audience: 'women',
      stock: '1',
      size: 'XL',
      sort: 'price-asc',
    });
    expect(result).toHaveLength(0);
    const sorted = filterProducts(products, { sort: 'price-asc' });
    expect(sorted[0].price).toBeLessThanOrEqual(sorted.at(-1)!.price);
  });
  it('does not fabricate sales', () =>
    expect(filterProducts(products, { sale: '1' })).toHaveLength(0));
  it('merges repeated device and account carts idempotently and caps stock', () => {
    const id = products[0].variants[0].id;
    expect(
      mergeCart([{ variantId: id, quantity: 5 }], [{ variantId: id, quantity: 3 }], products),
    ).toEqual([{ variantId: id, quantity: 5 }]);
    expect(mergeCart([{ variantId: id, quantity: 20 }], [], products)[0].quantity).toBe(7);
  });
});
describe('fulfilment and transactional email', () => {
  it('blocks jumps and unpaid live shipments', () => {
    expect(canFulfil('unfulfilled', 'shipped', 'paid', false)).toBe(false);
    expect(canFulfil('processing', 'shipped', 'unpaid', false)).toBe(false);
    expect(canFulfil('processing', 'shipped', 'paid', false)).toBe(true);
    expect(canFulfil('processing', 'shipped', 'unpaid', true)).toBe(true);
  });
  it('escapes user-controlled text', () =>
    expect(escapeHtml('<script> & "')).toBe('&lt;script&gt; &amp; &quot;'));
  it('never labels a test order paid', () => {
    const mail = orderEmail(
      'order_received',
      { number: 'ORE-2026-000001', test: true, total: 100, status: 'pending' },
      'https://example.test',
    );
    expect(mail.subject).toContain('TEST — UNPAID');
    expect(mail.text).toContain('No payment was collected');
    expect(mail.html).toContain('https://example.test/track-order');
  });
});

it('displays the available variant price range rather than an unattainable base price', () => {
  const p = {
    ...products[0],
    price: 1000,
    variants: [
      { ...products[0].variants[0], price: 2000 },
      { ...products[0].variants[1], price: 3000 },
    ],
  };
  expect(priceRange(p)).toEqual({ min: 2000, max: 3000 });
  expect(filterProducts([p], { max: '15' })).toHaveLength(0);
});
