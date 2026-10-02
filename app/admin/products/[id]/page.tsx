import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/features/admin/page-guard';
import { ProductEditor, type EditableProduct } from '@/features/admin/product-editor';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const { data: categories, error } = await db.from('categories').select('*').order('position');
  if (error) throw error;
  if (id === 'new') {
    const product: EditableProduct = {
      name: '',
      slug: '',
      description: '',
      short_description: '',
      category_id: '',
      audience: 'women',
      price: 0,
      compare_at: null,
      status: 'draft',
      tags: [],
      featured: false,
      details: [],
      care: '',
    };
    return (
      <>
        <h1>A new piece.</h1>
        <ProductEditor product={product} categories={categories || []} variants={[]} />
      </>
    );
  }
  if (!z.uuid().safeParse(id).success) notFound();
  const [p, v, m] = await Promise.all([
    db.from('products').select('*').eq('id', id).maybeSingle(),
    db.from('product_variants').select('*').eq('product_id', id).order('sku'),
    db.from('product_images').select('*').eq('product_id', id).order('position'),
  ]);
  if (p.error || v.error || m.error) throw p.error || v.error || m.error;
  if (!p.data) notFound();
  return (
    <>
      <h1>Edit this piece.</h1>
      <ProductEditor
        key={p.data.updated_at}
        product={p.data}
        categories={categories || []}
        variants={(v.data || []).map((v) => ({ ...v, expectedStock: v.stock }))}
        images={m.data || []}
      />
    </>
  );
}
