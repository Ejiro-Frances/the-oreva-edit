import { privilegedClient } from '@/lib/supabase/server';
import { processOutbox } from '@/lib/email/outbox';
import { apiError } from '@/lib/security';
import { authoriseCron } from '@/lib/cron';

async function run(request: Request) {
  try {
    authoriseCron(request);
    return Response.json(await processOutbox(privilegedClient()));
  } catch (error) {
    return apiError(error);
  }
}

/** External schedulers (e.g. cron-job.org) POST with Authorization: Bearer CRON_SECRET. */
export const POST = run;
/** Vercel Cron sends GET with Authorization: Bearer CRON_SECRET. */
export const GET = run;
