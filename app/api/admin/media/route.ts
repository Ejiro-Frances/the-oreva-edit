import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { requireAdmin } from '@/features/admin/guard';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
async function boundedForm(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Choose an image');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5500000) {
      await reader.cancel();
      throw new AppError('Image must be 5 MB or smaller', 413);
    }
    parts.push(value);
  }
  return new Response(Buffer.concat(parts), {
    headers: { 'Content-Type': request.headers.get('content-type') || '' },
  }).formData();
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const form = await boundedForm(request);
    const id = z.uuid().parse(form.get('productId'));
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > 5242880 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw new AppError('Choose a JPEG, PNG or WebP image up to 5 MB');
    const { data: product } = await db.from('products').select('id,name').eq('id', id).single();
    if (!product) throw new AppError('Product not found', 404);
    let buffer: Buffer;
    try {
      const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
        !metadata.width ||
        !metadata.height ||
        metadata.width < 300 ||
        metadata.height < 300
      )
        throw new Error('Invalid image');
      buffer = await image
        .rotate()
        .resize({ width: 1800, height: 2400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppError(
        'Choose a valid photograph at least 300 × 300 pixels, up to 25 megapixels',
      );
    }
    const path = `${id}/${randomUUID()}.webp`;
    const { error: upload } = await db.storage
      .from('product-images')
      .upload(path, buffer, { contentType: 'image/webp', upsert: false });
    if (upload) throw upload;
    const {
      data: { publicUrl },
    } = db.storage.from('product-images').getPublicUrl(path);
    const { count } = await db
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);
    const { error } = await db
      .from('product_images')
      .insert({ product_id: id, path, url: publicUrl, alt: product.name, position: count || 0 });
    if (error) {
      await db.storage.from('product-images').remove([path]);
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
const mutation = z.object({
  action: z.enum(['delete', 'primary', 'alt', 'reorder']),
  id: z.uuid().optional(),
  productId: z.uuid(),
  images: z.array(z.uuid()).max(50).optional(),
  alt: z.string().trim().min(1).max(250).optional(),
});
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const parsed = mutation.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('Check the image information');
    const p = parsed.data;
    if (p.action === 'reorder') {
      if (!p.images) throw new AppError('Choose image order');
      const { error } = await db.rpc('reorder_images', {
        p_product: p.productId,
        p_images: p.images,
      });
      if (error) throw new AppError('Images changed. Reload before reordering.', 409);
      return Response.json({ ok: true });
    }
    if (!p.id) throw new AppError('Image required');
    const { data: image, error } = await db
      .from('product_images')
      .select('*')
      .eq('id', p.id)
      .eq('product_id', p.productId)
      .single();
    if (error || !image) throw new AppError('Image not found', 404);
    if (p.action === 'delete') {
      const { data: path, error: del } = await db.rpc('remove_product_image', {
        p_product: p.productId,
        p_image: p.id,
      });
      if (del) throw new AppError('Archive the product before removing its last photograph.', 409);
      if (path) {
        const { error: remove } = await db.storage.from('product-images').remove([path]);
        if (remove)
          console.error(JSON.stringify({ event: 'orphaned_storage_image', product: p.productId }));
      }
    } else if (p.action === 'alt') {
      if (!p.alt) throw new AppError('Describe the image');
      const { error: e } = await db.from('product_images').update({ alt: p.alt }).eq('id', p.id);
      if (e) throw e;
    } else {
      const { error: e } = await db.rpc('make_primary_image', {
        p_product: p.productId,
        p_image: p.id,
      });
      if (e) throw e;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
