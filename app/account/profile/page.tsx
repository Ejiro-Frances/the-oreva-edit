import { requireCustomer } from '@/features/account/guard';
import { ProfileForm } from '@/features/account/profile-form';
function providerPhoto(metadata: Record<string, unknown> | undefined) {
  const url = metadata?.avatar_url || metadata?.picture;
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
export default async function Page() {
  const { user, db } = await requireCustomer();
  const { data, error } = await db!
    .from('profiles')
    .select('display_name,phone')
    .eq('id', user!.id)
    .single();
  if (error) throw error;
  const photo = providerPhoto(user!.user_metadata);
  return (
    <>
      <h1>Your details.</h1>
      {photo && (
        // Google-hosted avatar: a plain img avoids allow-listing its hosts for next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="profile-photo"
          src={photo}
          alt=""
          width={72}
          height={72}
          referrerPolicy="no-referrer"
        />
      )}
      <ProfileForm name={data.display_name} phone={data.phone} email={user!.email ?? ''} />
    </>
  );
}
