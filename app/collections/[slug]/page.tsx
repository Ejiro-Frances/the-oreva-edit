import { notFound } from 'next/navigation';
import { CataloguePage } from '@/features/catalogue/catalogue-page';
import { isFixture } from '@/lib/config';
import { publicClient } from '@/lib/supabase/server';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  let title = 'The everyday edit.';
  let description = 'A few good pieces. Endless ways to make them yours.';
  if (isFixture()) {
    if (slug !== 'the-everyday-edit') notFound();
  } else {
    const { data } = await publicClient()
      .from('collections')
      .select('name,description')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();
    if (!data) notFound();
    title = data.name;
    description = data.description;
  }
  return (
    <CataloguePage
      title={title}
      description={description}
      params={await searchParams}
      base={{ collection: slug }}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = 'The everyday edit';
  if (!isFixture()) {
    const { data } = await publicClient()
      .from('collections')
      .select('name')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();
    title = data?.name || 'Collection';
  }
  return { title, alternates: { canonical: '/collections/' + slug } };
}
