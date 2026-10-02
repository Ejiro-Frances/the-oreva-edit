'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui/field';
import type { Category } from '@/features/catalogue/types';
import { ProductMedia } from './product-media';
import { VariantEditor } from './variant-editor';
export type EditableProduct = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  category_id: string;
  audience: string;
  price: number;
  compare_at: number | null;
  status: 'draft' | 'active' | 'archived';
  tags: string[];
  featured: boolean;
  details: string[];
  care: string;
  seo_title?: string;
  seo_description?: string;
  updated_at?: string;
};
export type EditableVariant = {
  id?: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  expectedStock?: number;
  price: number | null;
  active: boolean;
};
export function ProductEditor({
  product,
  categories,
  variants: initial,
  images = [],
}: {
  product: EditableProduct;
  categories: Category[];
  variants: EditableVariant[];
  images?: { id: string; url: string; alt: string; position: number }[];
}) {
  const router = useRouter();
  const [variants, setVariants] = useState(initial);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        const f = new FormData(e.currentTarget);
        const payload = {
          ...product,
          name: String(f.get('name')),
          slug: String(f.get('slug')),
          description: String(f.get('description')),
          short_description: String(f.get('short_description')),
          category_id: String(f.get('category_id')),
          audience: String(f.get('audience')),
          price: Math.round(Number(f.get('price')) * 100),
          compare_at: f.get('compare_at') ? Math.round(Number(f.get('compare_at')) * 100) : null,
          status: f.get('status'),
          tags: String(f.get('tags'))
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          featured: f.get('featured') === 'on',
          details: String(f.get('details')).split('\n').filter(Boolean),
          care: String(f.get('care')),
          seo_title: String(f.get('seo_title')),
          seo_description: String(f.get('seo_description')),
        };
        try {
          const r = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: product.id,
              expectedUpdatedAt: product.updated_at,
              product: payload,
              variants,
            }),
          });
          const result = await r.json();
          if (!r.ok) {
            setMessage(result.error);
            return;
          }
          setMessage('Product saved.');
          router.push(`/admin/products/${result.id}`);
          router.refresh();
        } catch {
          setMessage('Product could not be saved. Your changes are still here.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend>01 / The essentials</legend>
        <div className="form-grid">
          {[
            ['name', 'Product name', product.name],
            ['slug', 'URL slug', product.slug],
            ['short_description', 'Short description', product.short_description],
            ['audience', 'Audience (e.g. women, men, girls)', product.audience],
          ].map(([name, label, value]) => (
            <Field key={name} id={name} label={label}>
              <input
                id={name}
                name={name}
                defaultValue={value}
                required={name !== 'short_description'}
              />
            </Field>
          ))}
          <Field id="category_id" label="Category">
            <select id="category_id" name="category_id" defaultValue={product.category_id} required>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="tags" label="Tags (comma separated)">
            <input id="tags" name="tags" defaultValue={product.tags.join(', ')} />
          </Field>
          <Field id="description" label="Description" className="span-2">
            <textarea
              id="description"
              name="description"
              defaultValue={product.description}
              required
              rows={4}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset>
        <legend>02 / Price & product details</legend>
        <div className="form-grid">
          <Field id="price" label="Price (₦)">
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product.price / 100}
              required
            />
          </Field>
          <Field id="compare_at" label="Genuine previous price (₦, optional)">
            <input
              id="compare_at"
              name="compare_at"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product.compare_at === null ? '' : product.compare_at / 100}
            />
          </Field>
          <Field id="details" label="Product details (one per line)">
            <textarea
              id="details"
              name="details"
              defaultValue={product.details.join('\n')}
              rows={4}
            />
          </Field>
          <Field id="care" label="Care instructions">
            <textarea id="care" name="care" defaultValue={product.care} rows={4} />
          </Field>
        </div>
      </fieldset>
      <VariantEditor variants={variants} setVariants={setVariants} />
      {product.id && (
        <fieldset>
          <legend>04 / Product photography</legend>
          <ProductMedia productId={product.id} images={images} />
        </fieldset>
      )}
      <fieldset>
        <legend>05 / Publishing</legend>
        <div className="form-grid">
          <Field id="status" label="Product status">
            <select name="status" id="status" defaultValue={product.status}>
              <option value="draft">Draft</option>
              <option value="active">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field id="seo_title" label="Search title (optional)">
            <input
              id="seo_title"
              name="seo_title"
              maxLength={70}
              defaultValue={product.seo_title || ''}
            />
          </Field>
          <Field id="seo_description" label="Search description (optional)">
            <textarea
              id="seo_description"
              name="seo_description"
              maxLength={170}
              defaultValue={product.seo_description || ''}
            />
          </Field>
          <label className="checkbox-label">
            <input type="checkbox" name="featured" defaultChecked={product.featured} />
            Feature on the storefront
          </label>
        </div>
        <p className="caption">
          Save a draft first to upload photography. Published products require at least one active
          variant and a photograph.
        </p>
      </fieldset>
      <button className="button" disabled={busy}>
        {busy ? 'Saving…' : 'Save product'}
      </button>
      <p role="status" className="field-error" style={{ marginTop: 15 }}>
        {message}
      </p>
    </form>
  );
}
