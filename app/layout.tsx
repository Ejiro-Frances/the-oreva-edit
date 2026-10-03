import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ShoppingProvider } from '@/features/cart/provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { getProducts, getCategories } from '@/features/catalogue/repository';
import { isFixture, siteUrl } from '@/lib/config';
import './globals.css';
import { getSiteSettings } from '@/features/catalogue/site-settings';
const display = localFont({
  src: [
    { path: '../public/fonts/display.woff2', style: 'normal', weight: '400 700' },
    { path: '../public/fonts/display-italic.woff2', style: 'italic', weight: '400 700' },
  ],
  variable: '--font-display',
  display: 'swap',
  weight: '400 700',
});
const body = localFont({
  src: '../public/fonts/body.woff2',
  variable: '--font-body',
  display: 'swap',
  weight: '400 800',
});
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'The Oreva Edit — Good pieces. Real life.', template: '%s | The Oreva Edit' },
  description:
    'A considered edit of clothing, shoes and accessories for women, men and little ones. Find your everyday point of view.',
  openGraph: {
    type: 'website',
    siteName: 'The Oreva Edit',
    locale: 'en_NG',
    images: ['/opengraph-image'],
  },
  twitter: { card: 'summary_large_image' },
  robots: isFixture() ? { index: false, follow: false } : undefined,
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let products: Awaited<ReturnType<typeof getProducts>> = [];
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  try {
    [products, categories] = await Promise.all([getProducts(), getCategories()]);
  } catch {
    /* Route boundary reports catalogue failure; navigation stays available. */
  }
  const settings = await getSiteSettings().catch(() => ({
    announcement: 'Welcome to The Oreva Edit',
    featured: 'the-everyday-edit',
  }));
  return (
    <html
      lang="en-NG"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable}`}
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ShoppingProvider>
          <Header
            products={products}
            categories={categories}
            announcement={settings.announcement}
            featured={settings.featured}
          />
          <main id="main-content">{children}</main>
          <Footer />
        </ShoppingProvider>
      </body>
    </html>
  );
}
