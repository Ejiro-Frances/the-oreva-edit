import { signInSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, readJson, sameOrigin } from '@/lib/security';
import { authClient, authFailure, clientIp } from '@/lib/auth/accounts';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = signInSchema.parse(await readJson(request));
    await rateLimit(`sign-in:${clientIp(request)}:${input.email}`, 10, 600);
    const { error } = await (await authClient()).auth.signInWithPassword(input);
    if (error) throw authFailure(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
