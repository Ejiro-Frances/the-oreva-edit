import { notFound } from 'next/navigation';
import { CataloguePage } from '@/features/catalogue/catalogue-page';
import { getCategories } from '@/features/catalogue/repository';
import { InformationPage, information } from '@/features/content/information';
import type { CatalogueFilters } from '@/features/catalogue/filter';
const sections: Record<string, { title: string; description: string; base: CatalogueFilters }> = {
  women: {
    title: 'Women',
    description:
      'For all the ways you show up. Discover clothing, shoes and details with a point of view.',
    base: { audience: 'women' },
  },
  men: {
    title: 'Men',
    description: 'Easy shapes. Considered details. The pieces you’ll live in.',
    base: { audience: 'men' },
  },
  kids: {
    title: 'Kids',
    description: 'Little people, big personalities. Pieces for play, parties and the everyday.',
    base: { audience: 'kids' },
  },
  girls: {
    title: 'Girls',
    description: 'A little colour, a little character. Let them make it their own.',
    base: { audience: 'girls' },
  },
  boys: {
    title: 'Boys',
    description: 'Everyday pieces for their next adventure.',
    base: { audience: 'boys' },
  },
  shoes: {
    title: 'Shoes',
    description: 'Find your footing. The finishing touch from the ground up.',
    base: { category: 'shoes' },
  },
  accessories: {
    title: 'Accessories',
    description: 'Small details. All the difference.',
    base: {},
  },
  jewellery: {
    title: 'Jewellery',
    description: 'The pieces that finish the story.',
    base: { category: 'jewellery' },
  },
  'new-in': {
    title: 'Fresh into the edit.',
    description: 'New arrivals, with plenty of room for your own point of view.',
    base: { sort: 'newest' },
  },
  'best-sellers': {
    title: 'Best sellers',
    description: 'The pieces customers return to.',
    base: {},
  },
  sale: {
    title: 'Sale',
    description: 'Genuine reductions, when there’s something to share.',
    base: { sale: '1' },
  },
};
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return {
    title: sections[section]?.title || information[section]?.title || section,
    alternates: { canonical: `/${section}` },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  if (information[section]) return <InformationPage slug={section} />;
  const config = sections[section];
  if (config) return <CataloguePage {...config} params={await searchParams} />;
  const category = (await getCategories()).find((c) => c.slug === section);
  if (category)
    return (
      <CataloguePage
        title={category.name}
        description="Find your next favourite in the edit."
        params={await searchParams}
        base={{ category: category.slug }}
      />
    );
  notFound();
}
