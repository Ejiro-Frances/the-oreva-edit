import { localPhone, type CheckoutInput } from '@/lib/validation';

export type CheckoutProfile = {
  display_name: string;
  phone: string;
  first_name?: string;
  last_name?: string;
};
export type SavedAddress = Omit<CheckoutInput, 'email'>;

/** Stored first/last names win; older profiles only have a display name to split. */
function profileName(profile?: CheckoutProfile | null) {
  if (profile?.first_name?.trim())
    return { firstName: profile.first_name.trim(), lastName: profile.last_name?.trim() ?? '' };
  const [firstName = '', ...rest] = (profile?.display_name ?? '').trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/**
 * Initial checkout values for the shopper. Delivery fields come from their most
 * recent saved address; the profile's name and phone win over the address's,
 * since those describe the signed-in customer rather than a past recipient.
 */
export function checkoutDefaults({
  email = '',
  profile,
  address,
}: {
  email?: string;
  profile?: CheckoutProfile | null;
  address?: SavedAddress | null;
}): Partial<CheckoutInput> {
  const name = profileName(profile);
  const blank = {
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    address: '',
    lga: '',
    landmark: '',
    instructions: '',
  };
  const merged = { ...blank, ...address, email };
  if (name.firstName) Object.assign(merged, name);
  if (profile?.phone) merged.phone = profile.phone;
  return { ...merged, phone: localPhone(merged.phone) };
}
