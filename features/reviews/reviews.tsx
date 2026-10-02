import Link from 'next/link';
import { publicClient, currentUser } from '@/lib/supabase/server';
import { isFixture } from '@/lib/config';
import { ReviewForm } from './review-form';
export async function Reviews({ productId }: { productId: string }) {
  if (isFixture())
    return (
      <p>
        No published reviews for this development sample. Customer reviews open when accounts and
        the catalogue are connected.
      </p>
    );
  const [{ data, error }, user] = await Promise.all([
    publicClient()
      .from('published_reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50),
    currentUser(),
  ]);
  if (error) throw error;
  return (
    <>
      {!data?.length && <p>No published reviews for this piece yet.</p>}
      {data?.map((r) => (
        <article key={r.id} className="review">
          <p className="caption">
            {r.rating} out of 5{r.verified_purchase ? ' · Verified purchase' : ''}
          </p>
          <h3>{r.title}</h3>
          <p>{r.body}</p>
        </article>
      ))}
      {user ? (
        <ReviewForm productId={productId} />
      ) : (
        <p>
          <Link className="text-link" href="/login">
            Sign in
          </Link>{' '}
          to share your experience.
        </p>
      )}
    </>
  );
}
