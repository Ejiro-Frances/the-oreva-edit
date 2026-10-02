import { requireCustomer } from '@/features/account/guard';
import { Addresses } from '@/features/account/addresses';
export default async function Page() {
  const { user, db } = await requireCustomer();
  const { data, error } = await db!
    .from('addresses')
    .select('id,label,details')
    .eq('user_id', user!.id);
  if (error) throw error;
  return (
    <>
      <h1>Your addresses.</h1>
      <Addresses addresses={data || []} />
    </>
  );
}
