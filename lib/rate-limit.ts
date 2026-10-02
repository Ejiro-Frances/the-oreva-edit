import 'server-only';
import { isFixture } from './config';
import { privilegedClient } from './supabase/server';
import { AppError, tokenHash } from './security';
const buckets = new Map<string, { count: number; until: number }>();
export async function rateLimit(key: string, limit: number, seconds: number) {
  if (isFixture()) {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
    const entry = buckets.get(key) || { count: 0, until: now + seconds * 1000 };
    entry.count++;
    buckets.set(key, entry);
    if (entry.count > limit) throw new AppError('Please wait a little before trying again.', 429);
    return;
  }
  const { data, error } = await privilegedClient().rpc('check_rate_limit', {
    p_key: tokenHash(key),
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new AppError('This service is temporarily unavailable', 503);
  if (!data) throw new AppError('Please wait a little before trying again.', 429);
}
