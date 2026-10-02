import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { orderEmail, type EmailPayload } from './template';
import { siteUrl } from '@/lib/config';
export async function sendTransactional(
  to: string,
  kind: string,
  payload: EmailPayload,
  idempotencyKey: string,
) {
  const message = orderEmail(kind, payload, siteUrl);
  if (process.env.EMAIL_MODE !== 'mailgun') {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Email capture is unavailable in production; configure Mailgun');
    await mkdir('.data/emails', { recursive: true });
    const id = randomUUID();
    await writeFile(`.data/emails/${id}.json`, JSON.stringify({ to, ...message }));
    return { id, captured: true };
  }
  const { MAILGUN_API_KEY: key, MAILGUN_DOMAIN: domain, MAILGUN_FROM_EMAIL: from } = process.env;
  if (!key || !domain || !from) throw new Error('Email provider is not configured');
  const form = new FormData();
  for (const [name, value] of Object.entries({
    from,
    to,
    ...message,
    'o:tracking': 'no',
    'h:Message-Id': `<${idempotencyKey}@${domain}>`,
  }))
    form.set(name, value);
  const region = process.env.MAILGUN_REGION === 'EU' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  const response = await fetch(`https://${region}/v3/${encodeURIComponent(domain)}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from('api:' + key).toString('base64') },
    body: form,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Email provider rejected delivery');
  return (await response.json()) as { id: string };
}
