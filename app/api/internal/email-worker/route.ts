import { timingSafeEqual } from 'node:crypto';
import { privilegedClient } from '@/lib/supabase/server';
import { processOutbox } from '@/lib/email/outbox';
import { apiError, AppError } from '@/lib/security';

function authorise(request: Request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (
    !expected ||
    !actual ||
    expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    throw new AppError('Unauthorised', 401);
}

async function run(request: Request) {
  try {
    authorise(request);
    return Response.json(await processOutbox(privilegedClient()));
  } catch (error) {
    return apiError(error);
  }
}

/** External schedulers (e.g. cron-job.org) POST with Authorization: Bearer CRON_SECRET. */
export const POST = run;
/** Vercel Cron sends GET with Authorization: Bearer CRON_SECRET. */
export const GET = run;
