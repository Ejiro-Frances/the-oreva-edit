import { newPasswordSchema } from '@/lib/validation';
import { apiError, AppError, readJson, sameOrigin } from '@/lib/security';
import { authClient, authFailure } from '@/lib/auth/accounts';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { password } = newPasswordSchema.parse(await readJson(request));
    const db = await authClient();
    const { data } = await db.auth.getUser();
    if (!data.user)
      throw new AppError('This reset link has expired. Please request a new one.', 401, 'expired');
    const { error } = await db.auth.updateUser({ password });
    if (error) throw authFailure(error);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
