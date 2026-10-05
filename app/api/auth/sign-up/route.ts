import { signUpSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, readJson, sameOrigin } from '@/lib/security';
import { authClient, authFailure, clientIp } from '@/lib/auth/accounts';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = signUpSchema.parse(await readJson(request));
    // Generous per IP: Nigerian mobile carriers put many customers behind one shared address.
    await rateLimit('sign-up:' + clientIp(request), 20, 600);
    const db = await authClient();
    const { data, error } = await db.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: `${input.firstName} ${input.lastName}`,
        },
      },
    });
    if (error) throw authFailure(error);
    // With Supabase "Confirm email" on there is no session; the store expects it off.
    if (!data.session) {
      console.error(JSON.stringify({ event: 'sign_up_without_session' }));
      return Response.json({ ok: true, confirm: true });
    }
    if (input.phone && data.user) {
      const saved = await db.from('profiles').update({ phone: input.phone }).eq('id', data.user.id);
      if (saved.error) console.error(JSON.stringify({ event: 'sign_up_phone_save_failed' }));
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
