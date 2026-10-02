import 'server-only';
import { cache } from 'react';
import { isFixture } from '@/lib/config';
import { publicClient } from '@/lib/supabase/server';
import { products, categories, deliveryZones } from './fixtures';
import type { Product, Category, DeliveryZone } from './types';

export const getProducts = cache(async (): Promise<Product[]> => {
  if (isFixture()) return products;
  const { data, error } = await publicClient()
    .from('catalogue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error('The catalogue is temporarily unavailable');
  return (data || []) as Product[];
});
export const getCategories = cache(async (): Promise<Category[]> => {
  if (isFixture()) return categories;
  const { data, error } = await publicClient()
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('position');
  if (error) throw new Error('Categories are temporarily unavailable');
  return data || [];
});
export const getDeliveryZones = cache(async (): Promise<DeliveryZone[]> => {
  if (isFixture()) return deliveryZones;
  const { data, error } = await publicClient()
    .from('delivery_zones')
    .select('*')
    .eq('active', true);
  if (error) throw new Error('Delivery information is temporarily unavailable');
  return data || [];
});
export const getProduct = cache(async (slug: string): Promise<Product | undefined> => {
  if (isFixture()) return products.find((p) => p.slug === slug);
  const { data, error } = await publicClient()
    .from('catalogue')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error('The piece is temporarily unavailable');
  return data || undefined;
});
export const getBestSellers = cache(async (): Promise<Product[]> => {
  if (isFixture()) return [];
  const { data, error } = await publicClient()
    .from('best_sellers')
    .select('product_id')
    .order('units', { ascending: false })
    .limit(100);
  if (error) throw error;
  const catalogue = await getProducts();
  return (data || []).flatMap((row) => {
    const product = catalogue.find((p) => p.id === row.product_id);
    return product ? [product] : [];
  });
});
