import 'server-only';
import { ZodError } from 'zod';
import { siteUrl } from '@/lib/config';
import { createHash } from 'node:crypto';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    /** Optional machine-readable reason the client can branch on. */
    public code?: string,
  ) {
    super(message);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(siteUrl).origin)
    throw new AppError('This request could not be verified. Please reload the page.', 403);
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('A request body is required');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 32768) {
      await reader.cancel();
      throw new AppError('This request is too large', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('Invalid request');
  }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message || 'Check the submitted information' },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json(
      error.code ? { error: error.message, code: error.code } : { error: error.message },
      { status: error.status },
    );
  console.error(
    JSON.stringify({
      event: 'request_failed',
      type: error instanceof Error ? error.name : 'UnknownError',
    }),
  );
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
export function safeRedirect(value: string | null) {
  return value && /^\/(?:account(?:\/[^?#]*)?|admin(?:\/[^?#]*)?|wishlist|checkout)$/.test(value)
    ? value
    : '/account';
}
