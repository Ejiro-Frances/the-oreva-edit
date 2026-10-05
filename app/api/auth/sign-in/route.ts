import { signInSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, readJson, sameOrigin } from '@/lib/security';
import {
  authClient,
  authFailure,
  clientIp,
  isMobileClient,
  sessionBody,
  statelessAuthClient,
} from '@/lib/auth/accounts';
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const mobile = isMobileClient(body);
    if (!mobile) sameOrigin(request);
    const input = signInSchema.parse(body);
    await rateLimit(`sign-in:${clientIp(request)}:${input.email}`, 10, 600);
    const db = mobile ? statelessAuthClient() : await authClient();
    const { data, error } = await db.auth.signInWithPassword(input);
    if (error) throw authFailure(error);
    if (mobile)
      return Response.json(sessionBody(data.session), { headers: { 'Cache-Control': 'no-store' } });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
