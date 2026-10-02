import { timingSafeEqual } from 'node:crypto';
import { privilegedClient } from '@/lib/supabase/server';
import { sendTransactional } from '@/lib/email/service';
import { apiError, AppError } from '@/lib/security';
import type { EmailPayload } from '@/lib/email/template';
export async function POST(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    const actual = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (
      !expected ||
      !actual ||
      expected.length !== actual.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    )
      throw new AppError('Unauthorised', 401);
    const db = privilegedClient();
    const { data, error } = await db.rpc('claim_emails');
    if (error) throw error;
    let sent = 0;
    for (const email of data || []) {
      try {
        const result = await sendTransactional(
          email.recipient,
          email.kind,
          email.payload as EmailPayload,
          email.id,
        );
        const { error: update } = await db
          .from('email_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), provider_id: result.id })
          .eq('id', email.id);
        if (update) throw update;
        sent++;
      } catch {
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
    return Response.json({ processed: data?.length || 0, sent });
  } catch (error) {
    return apiError(error);
  }
}
