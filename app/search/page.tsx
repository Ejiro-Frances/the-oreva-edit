import { CataloguePage } from '@/features/catalogue/catalogue-page';
export const metadata = { title: 'Search', robots: { index: false, follow: true } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CataloguePage
      title="Search"
      description="A few words can lead to a favourite. Search our current catalogue."
      params={await searchParams}
    />
  );
}
