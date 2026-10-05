import { getCategories } from '@/features/catalogue/repository';
import { catalogueCacheHeaders } from '@/features/catalogue/summary';
import { apiError } from '@/lib/security';
export async function GET() {
  try {
    return Response.json({ categories: await getCategories() }, { headers: catalogueCacheHeaders });
  } catch (error) {
    return apiError(error);
  }
}
