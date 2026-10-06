import { authoriseCron } from '@/lib/cron';
import { apiError } from '@/lib/security';
import { deleteStaleGuests } from '@/features/cart/guest-store';

const DAYS = 30;

async function run(request: Request) {
  try {
    authoriseCron(request);
    const before = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    return Response.json({ deleted: await deleteStaleGuests(before) });
  } catch (error) {
    return apiError(error);
  }
}

/** Vercel Cron sends GET; external schedulers may POST. Both need Authorization: Bearer CRON_SECRET. */
export const GET = run;
export const POST = run;
