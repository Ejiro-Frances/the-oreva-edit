import { rateLimit } from '@/lib/rate-limit';
import { apiError, AppError, sameOrigin } from '@/lib/security';
import { authClient, authFailure, confirmUrl } from '@/lib/auth/accounts';
/** Emails a one-time link; opening it (via /auth/confirm) marks the address verified. */
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = await authClient();
    const { data } = await db.auth.getUser();
    if (!data.user?.email) throw new AppError('Please sign in to continue', 401);
    await rateLimit('verify-email:' + data.user.id, 1, 60);
    const { error } = await db.auth.signInWithOtp({
      email: data.user.email,
      options: { shouldCreateUser: false, emailRedirectTo: confirmUrl },
    });
    if (error) throw authFailure(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
