import { getProduct } from '@/features/catalogue/repository';
import { catalogueCacheHeaders } from '@/features/catalogue/summary';
import { apiError } from '@/lib/security';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = /^[a-z0-9-]{1,120}$/.test(slug) ? await getProduct(slug) : undefined;
    if (!product || product.status !== 'active')
      return Response.json({ error: 'This piece is no longer available' }, { status: 404 });
    return Response.json({ product }, { headers: catalogueCacheHeaders });
  } catch (error) {
    return apiError(error);
  }
}
