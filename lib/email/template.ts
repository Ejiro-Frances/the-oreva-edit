import { money } from '@/lib/money';

/*
 * Order emails for The Oreva Edit.
 *
 * Structure follows proven transactional patterns (Postmark receipt layout, Litmus/Klaviyo
 * order-journey guidance): hidden preheader, wordmark, warm serif headline,
 * order meta, text-labelled progress tracker, one primary button, line items, totals,
 * delivery details, help links and footer.
 *
 * Email-client rules: table layout with role="presentation", 600px max, inline styles
 * (the <style> block only adds mobile and dark-mode refinements), no flex/grid or CSS
 * background images, Georgia/Arial fallbacks for the brand fonts, absolute image URLs
 * with alt text and fixed sizes, status never conveyed by colour alone, and a matching
 * plain-text part.
 */

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export type OrderEmailLine = {
  name: string;
  attributes: Record<string, string>;
  quantity: number;
  price: number;
  discount: number;
  image: string;
};
export type OrderEmailDetails = {
  number: string;
  contact: {
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    state?: string;
    lga?: string;
  };
  subtotal: number;
  delivery: number;
  total: number;
  created_at: string;
  items: OrderEmailLine[];
};
export type EmailPayload = {
  number: string;
  test: boolean;
  total: number;
  status: string;
  order?: OrderEmailDetails | null;
};

const STEPS = ['Received', 'Confirmed', 'Preparing', 'Shipped', 'Delivered'] as const;

type Copy = {
  title: string;
  heading: (name: string) => string;
  intro: string;
  /** Index into STEPS, or null when the order has left the normal journey. */
  step: number | null;
  /** Show the full receipt: subtotal, delivery charge and delivery address. */
  receipt: boolean;
  next?: string;
};
const COPY: Record<string, Copy> = {
  order_received: {
    title: 'Your order is received',
    heading: (n) => (n ? `Thank you, ${n}. We have your order.` : 'Thank you. We have your order.'),
    intro: 'We’re checking your pieces now and will confirm your order shortly.',
    step: 0,
    receipt: true,
    next: 'We’ll email you when your order is confirmed, and again when it ships.',
  },
  order_confirmed: {
    title: 'Your order is confirmed',
    heading: (n) => (n ? `Good news, ${n}. It’s confirmed.` : 'Good news. It’s confirmed.'),
    intro:
      'Your pieces are reserved for you. We’ll let you know as soon as we start preparing them.',
    step: 1,
    receipt: true,
    next: 'Next, we’ll prepare and pack your order, then email you when it ships.',
  },
  order_processing: {
    title: 'Your order is being prepared',
    heading: () => 'Your pieces are being prepared.',
    intro: 'We’re checking, pressing and packing each piece with care.',
    step: 2,
    receipt: false,
    next: 'We’ll email you as soon as your parcel is on its way.',
  },
  order_shipped: {
    title: 'Your order has shipped',
    heading: () => 'Your order is on its way.',
    intro: 'Your parcel has left our studio and is with our delivery partner.',
    step: 3,
    receipt: false,
    next: 'Please keep your phone nearby so the courier can reach you on delivery day.',
  },
  order_delivered: {
    title: 'Your order is delivered',
    heading: () => 'Your order has arrived.',
    intro: 'We hope you love your new pieces. If anything isn’t right, we’re here to help.',
    step: 4,
    receipt: false,
  },
  order_completed: {
    title: 'Your order is complete',
    heading: () => 'Your order is complete.',
    intro: 'Thank you for shopping with The Oreva Edit. Wear them well.',
    step: 4,
    receipt: false,
  },
  order_cancelled: {
    title: 'Your order is cancelled',
    heading: () => 'Your order has been cancelled.',
    intro:
      'The pieces reserved for you have been released. If you didn’t expect this, please contact us.',
    step: null,
    receipt: true,
  },
  order_returned: {
    title: 'Your return is recorded',
    heading: () => 'We’ve recorded your return.',
    intro: 'Thank you for sending your pieces back. We’ll be in touch about the next steps.',
    step: null,
    receipt: true,
  },
};
const FALLBACK: Copy = {
  title: 'An update on your order',
  heading: () => 'An update on your order.',
  intro: 'There’s a new update on your order.',
  step: null,
  receipt: false,
};

// Brand tokens from docs/DESIGN_SYSTEM.md.
const C = {
  page: '#faf8f3',
  card: '#fffdf8',
  surface: '#f0ece4',
  ink: '#292721',
  muted: '#6b655e',
  wine: '#62283a',
  border: '#dcd7ce',
  warning: '#805511',
};
// Brand fonts render where installed (Apple Mail); everyone else gets the classic fallbacks.
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Manrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const e = escapeHtml;
const pieces = (n: number) => `${n} ${n === 1 ? 'piece' : 'pieces'}`;
const variant = (attributes: Record<string, string>) =>
  Object.entries(attributes || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
const absolute = (src: string, site: string) =>
  /^https:\/\//.test(src) ? src : src.startsWith('/') ? site + src : '';
const lineTotal = (item: OrderEmailLine) => item.price * item.quantity - item.discount;
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Lagos',
      }).format(date);
};
const marker = (i: number, step: number) => (i < step ? '✓' : i === step ? '●' : '○');

export function orderEmail(kind: string, payload: EmailPayload, url: string) {
  const copy = COPY[kind] || FALLBACK;
  const order = payload.order ?? null;
  const name = order?.contact.firstName?.trim() || '';
  const items = order?.items ?? [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = order?.total ?? payload.total;
  const placed = order ? formatDate(order.created_at) : '';
  const trackUrl = `${url}/track-order?number=${encodeURIComponent(payload.number)}`;
  const subject = `${copy.title} · ${payload.number}`;
  const preheader = `${copy.title}. ${[payload.number, count ? pieces(count) : '', money(total)]
    .filter(Boolean)
    .join(' · ')}`;
  const paymentNote =
    'Sign in to review your order details. This status update is not a payment receipt.';
  const receipt = copy.receipt && order ? order : null;
  // Only an order still on its way shows where it is going.
  const address =
    receipt && copy.step !== null
      ? [
          [receipt.contact.firstName, receipt.contact.lastName].filter(Boolean).join(' '),
          receipt.contact.address,
          [receipt.contact.lga || receipt.contact.city, receipt.contact.state]
            .filter(Boolean)
            .join(', '),
        ].filter((line): line is string => Boolean(line && line.trim()))
      : [];
  const progress =
    copy.step === null
      ? []
      : STEPS.map((label, i) => ({ label, mark: marker(i, copy.step!), i, step: copy.step! }));

  const text = plainText();
  const html = htmlDocument();
  return { subject, text, html };

  function plainText() {
    const lines = [
      'THE OREVA EDIT',
      '',
      subject,
      '',
      copy.heading(name),
      copy.intro,
      '',
      `Order: ${payload.number}`,
      placed && `Placed: ${placed}`,
      progress.length && `Progress: ${progress.map((p) => `${p.label} ${p.mark}`).join(' · ')}`,
      '',
      ...items.map((item) => {
        const details = variant(item.attributes);
        return `- ${item.name}${details ? ` (${details})` : ''} × ${item.quantity}  ${money(lineTotal(item))}`;
      }),
      items.length && '',
      receipt && `Subtotal: ${money(receipt.subtotal)}`,
      receipt && `Delivery: ${receipt.delivery ? money(receipt.delivery) : 'Free'}`,
      `Total: ${money(total)}`,
      address.length && `\nDelivering to:\n${address.join('\n')}`,
      '',
      paymentNote,
      copy.next && `\n${copy.next}`,
      '',
      `View your order: ${trackUrl}`,
      `Questions? ${url}/contact`,
      '',
      'The Oreva Edit. Good pieces. Real life.',
    ].filter((line): line is string => typeof line === 'string');
    // Collapse repeated blank lines left by optional sections.
    return lines.filter((line, i) => !(line === '' && lines[i - 1] === '')).join('\n');
  }

  function htmlDocument() {
    const label = (t: string) =>
      `<p class="muted" style="margin:0 0 8px;font-family:${SANS};font-size:11px;letter-spacing:2px;color:${C.muted}">${t}</p>`;
    const para = (t: string) =>
      `<p class="ink" style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.ink}">${t}</p>`;
    const link = (path: string, t: string) =>
      `<a href="${e(url + path)}" class="accent" style="color:${C.wine};text-decoration:underline">${t}</a>`;

    const tracker = progress.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rule" style="margin:28px 0 4px;border-top:1px solid ${C.border}"><tr>${progress
          .map(({ label: step, mark, i, step: current }) => {
            const upcoming = i > current;
            const active = i === current;
            return `<td width="20%" align="center" class="step ${upcoming ? 'muted' : 'accent'}" style="padding:12px 2px 0;font-family:${SANS};font-size:12px;line-height:1.4;color:${upcoming ? C.muted : C.wine};font-weight:${active ? 700 : 400}${active ? `;border-top:2px solid ${C.wine}` : ''}">${mark} ${step}</td>`;
          })
          .join('')}</tr></table>`
      : '';

    const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px"><tr><td bgcolor="${C.wine}" class="btn" style="background:${C.wine}"><a href="${e(trackUrl)}" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:1px;color:#fffdf8;text-decoration:none">VIEW YOUR ORDER</a></td></tr></table>`;

    const itemRows = items
      .map((item) => {
        const src = absolute(item.image, url);
        const details = variant(item.attributes);
        const cell = `border-bottom:1px solid ${C.border}`;
        const image = src
          ? `<img src="${e(src)}" width="60" height="80" alt="${e(item.name)}" style="display:block;width:60px;height:80px;object-fit:cover;border:0;background:${C.surface};font-family:${SANS};font-size:10px;color:${C.muted}">`
          : '';
        return `<tr><td width="76" valign="top" class="rule" style="padding:16px 16px 16px 0;${cell}">${image}</td><td valign="top" class="rule" style="padding:16px 0;${cell}"><p class="ink" style="margin:0 0 4px;font-family:${SERIF};font-size:19px;line-height:1.25;color:${C.ink}">${e(item.name)}</p>${
          details
            ? `<p class="muted" style="margin:0 0 4px;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.muted}">${e(details)}</p>`
            : ''
        }<p class="muted" style="margin:0;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.muted}">Qty ${item.quantity} × ${e(money(item.price))}</p></td><td valign="top" align="right" class="ink rule" style="padding:16px 0 16px 12px;${cell};font-family:${SANS};font-size:14px;color:${C.ink};white-space:nowrap">${e(money(lineTotal(item)))}</td></tr>`;
      })
      .join('');
    const itemsSection = items.length
      ? `<h2 class="ink" style="margin:36px 0 4px;font-family:${SERIF};font-size:22px;font-weight:500;color:${C.ink}">In your order</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemRows}</table>`
      : '';

    const totalRow = (name: string, value: string, strong = false) => {
      const font = strong
        ? `font-family:${SERIF};font-size:22px`
        : `font-family:${SANS};font-size:14px`;
      const pad = strong ? '14px' : '6px';
      return `<tr><td class="${strong ? 'ink' : 'muted'}" style="padding:${pad} 0 0;${font};color:${strong ? C.ink : C.muted}">${name}</td><td align="right" class="ink" style="padding:${pad} 0 0;${font};color:${C.ink}">${e(value)}</td></tr>`;
    };
    const totals = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">${
      receipt
        ? totalRow('Subtotal', money(receipt.subtotal)) +
          totalRow('Delivery', receipt.delivery ? money(receipt.delivery) : 'Free')
        : ''
    }${totalRow('Total', money(total), true)}</table>`;

    const details =
      address.length || copy.next
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rule" style="margin-top:32px;border-top:1px solid ${C.border}"><tr>${
            address.length
              ? `<td class="stack" width="50%" valign="top" style="padding:24px 16px 0 0">${label('DELIVERING TO')}${para(address.map(e).join('<br>'))}</td>`
              : ''
          }${
            copy.next
              ? `<td class="stack" valign="top" style="padding:24px 0 0">${label('WHAT HAPPENS NEXT')}${para(e(copy.next))}</td>`
              : ''
          }</tr></table>`
        : '';

    return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(subject)}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
@media (max-width:620px){.container{width:100%!important}.pad{padding:28px 20px!important}.h1{font-size:30px!important}.stack{display:block!important;width:100%!important;padding-right:0!important}.step{font-size:11px!important}}
@media (prefers-color-scheme: dark){.bg{background:#1c1a17!important}.card{background:#24211d!important;border-color:#3a352f!important}.ink{color:#f3efe6!important}.muted{color:#bdb4a8!important}.accent{color:#e2aebd!important}.rule{border-color:#3a352f!important}.btn{background:#7d3a50!important}.banner{background:#3a2e17!important;border-color:#6b5426!important;color:#f0d49c!important}}
[data-ogsc] .ink{color:#f3efe6!important}[data-ogsc] .muted{color:#bdb4a8!important}[data-ogsc] .accent{color:#e2aebd!important}[data-ogsb] .bg{background:#1c1a17!important}[data-ogsb] .card{background:#24211d!important}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${e(preheader)}${'&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" class="bg" style="background:${C.page}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
<tr><td align="center" style="padding:0 0 24px"><a href="${e(url)}" class="ink" style="font-family:${SERIF};font-size:22px;letter-spacing:6px;color:${C.ink};text-decoration:none">THE OREVA EDIT</a></td></tr>
<tr><td class="card pad" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};padding:40px 44px">
<p class="muted" style="margin:0 0 16px;font-family:${SANS};font-size:11px;letter-spacing:2px;color:${C.muted}">ORDER ${e(payload.number)}${placed ? ` · ${e(placed.toUpperCase())}` : ''}</p>
<h1 class="h1 ink" style="margin:0 0 14px;font-family:${SERIF};font-size:36px;line-height:1.15;font-weight:500;color:${C.ink}">${e(copy.heading(name))}</h1>
<p class="ink" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink}">${e(copy.intro)}</p>
${tracker}
${button}
${itemsSection}
${totals}
${details}
<p class="muted" style="margin:32px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">${e(paymentNote)}</p>
</td></tr>
<tr><td align="center" class="muted" style="padding:28px 24px 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted}">
<p style="margin:0 0 8px">Questions about your order? ${link('/contact', 'Contact us')} · ${link('/delivery', 'Delivery')} · ${link('/returns', 'Returns')}</p>
<p style="margin:0 0 8px;font-family:${SERIF};font-size:16px;font-style:italic">Good pieces. Real life.</p>
<p style="margin:0;font-size:11px">You’re receiving this because you placed order ${e(payload.number)} at The Oreva Edit.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
  }
}
