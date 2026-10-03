import { priceRange } from '@/features/catalogue/price';
import { Reviews } from '@/features/reviews/reviews';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getProducts } from '@/features/catalogue/repository';
import { ProductGallery } from '@/features/catalogue/product-gallery';
import { ProductOptions } from '@/features/catalogue/product-options';
import { ProductSelectionProvider } from '@/features/catalogue/product-selection';
import { ProductCard } from '@/features/catalogue/product-card';
import { siteUrl } from '@/lib/config';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  return p
    ? {
        title: p.seo_title || p.name,
        description: p.seo_description || p.short_description,
        alternates: { canonical: `/products/${p.slug}` },
        openGraph: { images: p.images },
      }
    : { title: 'Piece not found' };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const related = (await getProducts())
    .filter((x) => x.id !== p.id && x.audience === p.audience)
    .slice(0, 4);
  const range = priceRange(p);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.short_description,
    image: p.images.map((x) => new URL(x, siteUrl).href),
    sku: p.variants[0]?.sku,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'NGN',
      lowPrice: range.min / 100,
      highPrice: range.max / 100,
      offerCount: p.variants.length,
      availability: p.variants.some((v) => v.stock > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${siteUrl}/products/${p.slug}`,
    },
  };
  return (
    <div className="container">
      {!p.fixture && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              schema,
              {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
                  { '@type': 'ListItem', position: 2, name: 'Shop', item: siteUrl + '/shop' },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: p.name,
                    item: siteUrl + '/products/' + p.slug,
                  },
                ],
              },
            ]).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">The edit</Link>
        <span>/</span>
        <span>{p.name}</span>
      </div>
      <ProductSelectionProvider product={p} key={p.id}>
        <div className="product-detail">
          <ProductGallery />
          <div className="product-info">
            <span className="eyebrow">{p.category} / THE OREVA EDIT</span>
            <h1>{p.name}</h1>
            <ProductOptions />
            <details className="disclosure" open>
              <summary>The story</summary>
              <p>{p.description}</p>
            </details>
            <details className="disclosure">
              <summary>Details & care</summary>
              <ul>
                {p.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p>{p.care}</p>
            </details>
            <details className="disclosure">
              <summary>Delivery & returns</summary>
              <p>
                Delivery availability and charges depend on your address.{' '}
                <Link href="/delivery" className="text-link">
                  Read delivery information
                </Link>
              </p>
              <p>
                <Link href="/returns" className="text-link">
                  Read returns information
                </Link>
              </p>
            </details>
            <details className="disclosure">
              <summary>Reviews</summary>
              <Reviews productId={p.id} />
            </details>
          </div>
        </div>
      </ProductSelectionProvider>
      {related.length > 0 && (
        <section style={{ paddingBottom: 60 }}>
          <div className="section-heading">
            <h2>Good together.</h2>
            <Link className="text-link" href="/shop">
              Explore the edit
            </Link>
          </div>
          <div className="product-grid">
            {related.map((x) => (
              <ProductCard product={x} key={x.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
