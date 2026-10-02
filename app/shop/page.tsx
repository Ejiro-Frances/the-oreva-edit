import { CataloguePage } from '@/features/catalogue/catalogue-page';
export const metadata = { title: 'Shop the edit', alternates: { canonical: '/shop' } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CataloguePage
      title="The whole edit."
      description="Thoughtfully chosen clothing, shoes and finishing touches. Find the pieces that feel like you."
      params={await searchParams}
    />
  );
}
