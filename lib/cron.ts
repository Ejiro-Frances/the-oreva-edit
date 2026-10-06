import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@/lib/security';

/** Scheduled jobs (Vercel Cron, external schedulers) send Authorization: Bearer CRON_SECRET. */
export function authoriseCron(request: Request) {
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
