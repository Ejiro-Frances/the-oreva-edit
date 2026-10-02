import Link from 'next/link';
import { getProducts, getCategories, getBestSellers } from './repository';
import { filterProducts, type CatalogueFilters } from './filter';
import { FilterForm, MobileFilters } from './filters';
import { ProductCard } from './product-card';
import { EmptyState } from '@/components/ui/empty-state';
export async function CataloguePage({
  title,
  description,
  params,
  base = {},
}: {
  title: string;
  description: string;
  params: Record<string, string | string[] | undefined>;
  base?: CatalogueFilters;
}) {
  const all = await getProducts();
  const categories = await getCategories();
  const filters: CatalogueFilters = {
    ...Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === 'string')),
    ...base,
    sort: typeof params.sort === 'string' ? params.sort : base.sort,
  };
  let source = all;
  if (title === 'Accessories')
    source = all.filter((p) => ['Bags', 'Jewellery', 'Accessories'].includes(p.category));
  if (title === 'Best sellers') {
    source = await getBestSellers();
    if (!filters.sort) filters.sort = 'best-selling';
  }
  if (filters.category) {
    const slugs = new Set([filters.category]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of categories) {
        const parent = categories.find((p) => p.id === c.parent_id);
        if (parent && slugs.has(parent.slug) && !slugs.has(c.slug)) {
          slugs.add(c.slug);
          changed = true;
        }
      }
    }
    source = source.filter((p) =>
      slugs.has(p.category_slug || p.category.toLowerCase().replaceAll(' ', '-')),
    );
  }
  const filtered = filterProducts(source, { ...filters, category: undefined });
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 12;
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  function pageLink(n: number) {
    const search = new URLSearchParams(
      Object.entries(params).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    search.set('page', String(n));
    return `?${search}`;
  }
  return (
    <div className="container">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>{title}</span>
      </div>
      <div className="page-heading">
        <span className="eyebrow">THE OREVA WARDROBE</span>
        <h1>{filters.q ? `Results for “${filters.q}”` : title}</h1>
        <p>{description}</p>
      </div>
      {title === 'Search' && (
        <form className="search-form">
          <label htmlFor="page-search" className="sr-only">
            Search products
          </label>
          <input
            id="page-search"
            name="q"
            defaultValue={filters.q}
            placeholder="What are you looking for?"
          />
          <button className="button">Search</button>
        </form>
      )}
      <div className="catalogue-toolbar">
        <MobileFilters categories={categories} products={source} filters={filters} />
        <p>
          {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'} in this edit
        </p>
        <span className="caption">Prices in NGN ₦</span>
      </div>
      <div className="catalogue-layout">
        <aside className="filter-sidebar" aria-label="Catalogue filters">
          <FilterForm categories={categories} products={source} filters={filters} />
        </aside>
        <div>
          {shown.length ? (
            <div className="product-grid">
              {shown.map((p, i) => (
                <ProductCard eager={i < 4} product={p} key={p.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="A fresh start for your search."
              description={
                title === 'Best sellers'
                  ? 'Our favourites earn their place. Best sellers will appear once real order data is available.'
                  : 'No pieces match this selection. Try another category or clear a filter.'
              }
              action="See all pieces"
            />
          )}
          {filtered.length > pageSize && (
            <nav className="pagination" aria-label="Catalogue pages">
              {Array.from({ length: Math.ceil(filtered.length / pageSize) }, (_, i) => (
                <Link
                  aria-current={page === i + 1 ? 'page' : undefined}
                  key={i}
                  href={pageLink(i + 1)}
                >
                  {i + 1}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
