import { describe, expect, it } from 'vitest';
import { orderEmail, type EmailPayload, type OrderEmailDetails } from '@/lib/email/template';

const site = 'https://the-oreva-edit.vercel.app';
const order: OrderEmailDetails = {
  number: 'ORE-2026-000042',
  contact: {
    firstName: 'Adaeze',
    lastName: 'Okafor',
    address: '10 Admiralty Way',
    city: 'Lekki',
    state: 'Lagos',
  },
  subtotal: 6200000,
  delivery: 350000,
  total: 6550000,
  created_at: '2026-10-03T10:00:00Z',
  items: [
    {
      name: 'Sade Midi Dress',
      attributes: { Size: 'M', Colour: 'Wine' },
      quantity: 1,
      price: 3850000,
      discount: 0,
      image: '/images/sade.jpg',
    },
    {
      name: 'Tobi Linen Shirt',
      attributes: { Size: 'L' },
      quantity: 2,
      price: 1175000,
      discount: 0,
      image: 'https://cdn.example.test/tobi.jpg',
    },
  ],
};
const payload = (kind: Partial<EmailPayload> = {}): EmailPayload => ({
  number: order.number,
  test: true,
  total: order.total,
  status: 'pending',
  order,
  ...kind,
});

describe('order email template', () => {
  it('confirms a received order with greeting, items, totals and address', () => {
    const { subject, html, text } = orderEmail('order_received', payload(), site);
    expect(subject).toBe('Your order is received · ORE-2026-000042');
    expect(html).toContain('Adaeze');
    expect(html).toContain('Sade Midi Dress');
    expect(html).toContain('Size: M · Colour: Wine');
    expect(html).toContain('₦65,500');
    expect(html).toContain('₦3,500');
    expect(html).toContain('10 Admiralty Way');
    expect(html).toContain('Lekki, Lagos');
    expect(text).toContain('Tobi Linen Shirt');
    expect(text).toContain('Total: ₦65,500');
  });

  it('links to the prefilled order tracker and uses absolute image URLs', () => {
    const { html, text } = orderEmail('order_received', payload(), site);
    expect(html).toContain(`${site}/track-order?number=ORE-2026-000042`);
    expect(text).toContain(`${site}/track-order?number=ORE-2026-000042`);
    expect(html).toContain(`src="${site}/images/sade.jpg"`);
    expect(html).toContain('src="https://cdn.example.test/tobi.jpg"');
    expect(html).toMatch(/<img[^>]+alt="Sade Midi Dress"/);
  });

  it.each([true, false])(
    'shows customers no test wording and never claims payment (test: %s)',
    (test) => {
      const { subject, html, text } = orderEmail('order_confirmed', payload({ test }), site);
      expect(subject).not.toContain('TEST');
      expect(html).not.toMatch(/test order/i);
      expect(text).not.toMatch(/test order/i);
      expect(html).toContain('not a payment receipt');
    },
  );

  it('shows progress with text markers, not colour alone', () => {
    const { html, text } = orderEmail('order_shipped', payload({ status: 'shipped' }), site);
    expect(html).toContain('✓ Received');
    expect(html).toContain('● Shipped');
    expect(html).toContain('○ Delivered');
    expect(text).toContain(
      'Progress: Received ✓ · Confirmed ✓ · Preparing ✓ · Shipped ● · Delivered ○',
    );
  });

  it('has no progress tracker for cancellations', () => {
    const { html } = orderEmail('order_cancelled', payload({ status: 'cancelled' }), site);
    expect(html).not.toContain('● ');
    expect(html).not.toContain('DELIVERING TO');
    expect(html).toContain('cancelled');
  });

  it('includes preheader, dark-mode and accessibility hooks', () => {
    const { html } = orderEmail('order_received', payload(), site);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toMatch(/<table role="presentation"/);
    expect(html).toContain('3 pieces · ₦65,500');
  });

  it('escapes customer-controlled content', () => {
    const hostile = {
      ...order,
      contact: { ...order.contact, firstName: '<img src=x onerror=alert(1)>' },
      items: [{ ...order.items[0], name: '"><script>alert(1)</script>' }],
    };
    const { html } = orderEmail('order_received', payload({ order: hostile }), site);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('still produces a useful summary without order details', () => {
    const { html, text } = orderEmail('order_received', payload({ order: null }), site);
    expect(html).toContain('ORE-2026-000042');
    expect(html).toContain('₦65,500');
    expect(text).toContain('Total: ₦65,500');
  });

  it('stays well under the Gmail clipping threshold', () => {
    const many = { ...order, items: Array.from({ length: 20 }, () => order.items[0]) };
    const { html } = orderEmail('order_received', payload({ order: many }), site);
    expect(Buffer.byteLength(html)).toBeLessThan(90_000);
  });

  it('falls back to a generic update for unknown kinds', () => {
    expect(orderEmail('order_mystery', payload(), site).subject).toContain(
      'An update on your order',
    );
  });
});
