import 'server-only';
import { after } from 'next/server';
import { isFixture } from '@/lib/config';
import { privilegedClient } from '@/lib/supabase/server';
import { sendTransactional } from './service';
import type { EmailPayload, OrderEmailDetails } from './template';

type Db = ReturnType<typeof privilegedClient>;
type Send = typeof sendTransactional;

/** Production only delivers through Mailgun; local development captures previews to .data/emails. */
export const emailDeliveryEnabled = () =>
  process.env.EMAIL_MODE === 'mailgun' || process.env.NODE_ENV !== 'production';

const ORDER_FIELDS =
  'number,contact,subtotal,delivery,total,created_at,items:order_items(name,attributes,quantity,price,discount,image)';

async function loadOrder(db: Db, orderId: string): Promise<OrderEmailDetails | null> {
  try {
    const { data, error } = await db
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return (data as OrderEmailDetails | null) ?? null;
  } catch {
    // A summary email is better than none; the template copes without line items.
    log('email_order_details_unavailable');
    return null;
  }
}

/**
 * Claims due outbox rows (pending, failed past backoff, or expired leases) and sends them.
 * Safe to run concurrently: claim_emails uses SKIP LOCKED and a lease.
 */
export async function processOutbox(db: Db, send: Send = sendTransactional) {
  const { data, error } = await db.rpc('claim_emails');
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    order_id: string | null;
    kind: string;
    recipient: string;
    payload: EmailPayload;
    attempts: number;
  }>;
  let sent = 0;
  for (const email of rows) {
    try {
      const order = email.order_id ? await loadOrder(db, email.order_id) : null;
      const result = await send(email.recipient, email.kind, { ...email.payload, order }, email.id);
      const { error: update } = await db
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), provider_id: result.id })
        .eq('id', email.id);
      if (update) throw update;
      sent++;
    } catch (error) {
      log('email_send_failed', {
        kind: email.kind,
        attempts: email.attempts,
        type: error instanceof Error ? error.message : 'unknown',
      });
      await db
        .from('email_outbox')
        .update({
          status: 'failed',
          available_at: new Date(
            Date.now() + Math.min(3600, 60 * 2 ** email.attempts) * 1000,
          ).toISOString(),
        })
        .eq('id', email.id);
    }
  }
  return { processed: rows.length, sent };
}

/**
 * Sends queued email right after the current response finishes, so customers do not wait
 * for the scheduled worker. The worker remains the retry backstop.
 */
export function deliverQueuedEmailsSoon() {
  if (isFixture() || !emailDeliveryEnabled()) return;
  after(async () => {
    try {
      await processOutbox(privilegedClient());
    } catch (error) {
      log('email_outbox_unavailable', { type: error instanceof Error ? error.name : 'unknown' });
    }
  });
}

function log(event: string, details: Record<string, unknown> = {}) {
  // Never log recipients, addresses or message bodies.
  console.error(JSON.stringify({ event, ...details }));
}
