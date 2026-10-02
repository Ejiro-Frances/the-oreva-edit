import { money } from '@/lib/money';
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export type EmailPayload = { number: string; test: boolean; total: number; status: string };
export function orderEmail(kind: string, payload: EmailPayload, url: string) {
  const stages: Record<string, string> = {
    order_completed: 'Your order is complete',
    order_received: 'Your order is received',
    order_confirmed: 'Your order is confirmed',
    order_processing: 'Your order is being prepared',
    order_shipped: 'Your order has shipped',
    order_delivered: 'Your order is delivered',
    order_cancelled: 'Your order is cancelled',
    order_returned: 'Your return is recorded',
  };
  const title = stages[kind] || 'An update on your order';
  const prefix = payload.test ? '[TEST — UNPAID] ' : '';
  const subject = prefix + title + ' · ' + payload.number;
  const note = payload.test
    ? 'This is a development test. No payment was collected and no goods will be delivered.'
    : 'Sign in to review your order details. This status update is not a payment receipt.';
  const text = `THE OREVA EDIT\n\n${subject}\n\nOrder: ${payload.number}\nTotal: ${money(payload.total)}\nStatus: ${payload.status}\n\n${note}\n\nView your order: ${url}/track-order\n\nThe Oreva Edit`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#faf8f3;color:#292721;font-family:Georgia,serif"><main style="max-width:560px;margin:0 auto;padding:40px 24px"><p style="letter-spacing:3px;font-size:13px">THE OREVA EDIT</p><h1 style="font-weight:normal;font-size:32px">${escapeHtml(prefix + title)}</h1><p>Order ${escapeHtml(payload.number)}</p><p>Total: ${escapeHtml(money(payload.total))}</p><p>${escapeHtml(note)}</p><p><a style="color:#62283a" href="${escapeHtml(url)}/track-order">View your order</a></p><p>Good pieces. Real life.</p></main></body></html>`;
  return { subject, text, html };
}
