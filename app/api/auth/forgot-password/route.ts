import { emailOnlySchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, readJson, sameOrigin } from '@/lib/security';
import { authClient, clientIp, confirmUrl } from '@/lib/auth/accounts';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { email } = emailOnlySchema.parse(await readJson(request));
    await rateLimit(`forgot-password:${clientIp(request)}`, 10, 600);
    const { error } = await (
      await authClient()
    ).auth.resetPasswordForEmail(email, {
      redirectTo: confirmUrl,
    });
    // The response is identical whether or not the address has an account.
    if (error) console.error(JSON.stringify({ event: 'reset_email_failed', code: error.code }));
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
