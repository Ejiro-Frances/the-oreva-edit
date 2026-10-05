/** Posts JSON to a same-origin route; network failures become a friendly error. */
export async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string; code?: string; confirm?: boolean }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    return { ...result, ok: response.ok };
  } catch {
    return {
      ok: false,
      error: 'We couldn’t reach the store. Check your connection and try again.',
    };
  }
}
