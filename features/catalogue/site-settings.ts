import 'server-only';
import { cache } from 'react';
import { isFixture } from '@/lib/config';
import { publicClient } from '@/lib/supabase/server';
export const getSiteSettings = cache(async () => {
  const defaults = {
    announcement: 'Thoughtfully chosen. Effortlessly you.',
    featured: 'the-everyday-edit',
  };
  if (isFixture()) return defaults;
  const { data, error } = await publicClient().from('site_settings').select('key,value');
  if (error) throw error;
  return {
    announcement: data.find((r) => r.key === 'announcement')?.value || defaults.announcement,
    featured: data.find((r) => r.key === 'featured_collection')?.value || defaults.featured,
  } as typeof defaults;
});
