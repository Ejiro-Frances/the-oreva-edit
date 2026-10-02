'use client';
import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import type { Category, Product } from './types';
import type { CatalogueFilters } from './filter';
export function FilterForm({
  categories,
  products,
  filters,
  onSubmit,
}: {
  categories: Category[];
  products: Product[];
  filters: CatalogueFilters;
  onSubmit?: () => void;
}) {
  const sizes = [
    ...new Set(products.flatMap((p) => p.variants.map((v) => v.attributes.Size)).filter(Boolean)),
  ];
  const colours = [
    ...new Set(products.flatMap((p) => p.variants.map((v) => v.attributes.Colour)).filter(Boolean)),
  ];
  return (
    <form className="filter-form" onSubmit={onSubmit}>
      {filters.q && <input type="hidden" name="q" value={filters.q} />}
      <label>
        Category
        <select name="category" defaultValue={filters.category || ''}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Size
        <select name="size" defaultValue={filters.size || ''}>
          <option value="">All sizes</option>
          {sizes.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Colour
        <select name="colour" defaultValue={filters.colour || ''}>
          <option value="">All colours</option>
          {colours.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Maximum price (₦)
        <input
          name="max"
          type="number"
          min="0"
          defaultValue={filters.max}
          placeholder="Any price"
        />
      </label>
      <label>
        Sort by
        <select name="sort" defaultValue={filters.sort || 'featured'}>
          {filters.sort === 'best-selling' && <option value="best-selling">Best selling</option>}
          <option value="featured">Featured</option>
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="stock" value="1" defaultChecked={!!filters.stock} />
        In stock only
      </label>
      <button className="button">Apply filters</button>
      <a className="text-link" href="?">
        Clear filters
      </a>
    </form>
  );
}
export function MobileFilters(props: Parameters<typeof FilterForm>[0]) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="filter-toggle" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={16} />
        Filter & sort
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Make it your edit" side>
        <FilterForm {...props} onSubmit={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
