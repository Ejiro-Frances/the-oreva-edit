import type { MetadataRoute } from 'next';
import { siteUrl, isFixture } from '@/lib/config';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: isFixture()
      ? { userAgent: '*', disallow: '/' }
      : {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/admin',
            '/account',
            '/api',
            '/auth',
            '/cart',
            '/checkout',
            '/wishlist',
            '/order-confirmation',
            '/track-order',
            '/login',
            '/search',
          ],
        },
    sitemap: siteUrl + '/sitemap.xml',
  };
}
