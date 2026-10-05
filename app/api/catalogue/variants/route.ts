import { z } from 'zod';
import { getProducts } from '@/features/catalogue/repository';
import { lineDetails } from '@/features/cart/lines';
import { catalogueCacheHeaders } from '@/features/catalogue/summary';
import { apiError, AppError } from '@/lib/security';
const ids = z.array(z.uuid()).min(1).max(50);
export async function GET(request: Request) {
  try {
    const parsed = ids.safeParse(new URL(request.url).searchParams.get('ids')?.split(',') ?? []);
    if (!parsed.success) throw new AppError('Your bag needs to be refreshed', 400);
    return Response.json(
      { lines: lineDetails(parsed.data, await getProducts()) },
      { headers: catalogueCacheHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}
