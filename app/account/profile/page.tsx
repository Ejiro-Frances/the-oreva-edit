import { requireCustomer } from '@/features/account/guard';
import { ProfileForm } from '@/features/account/profile-form';
export default async function Page() {
  const { user, db } = await requireCustomer();
  const { data, error } = await db!
    .from('profiles')
    .select('display_name,phone')
    .eq('id', user!.id)
    .single();
  if (error) throw error;
  return (
    <>
      <h1>Your details.</h1>
      <ProfileForm name={data.display_name} phone={data.phone} />
      <p className="caption" style={{ marginTop: 25 }}>
        Your sign-in email is managed by your authentication provider.
      </p>
    </>
  );
}
