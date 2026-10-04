import { localPhone, type CheckoutInput } from '@/lib/validation';

export type CheckoutProfile = { display_name: string; phone: string };
export type SavedAddress = Omit<CheckoutInput, 'email'>;

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
  const [firstName = '', ...rest] = (profile?.display_name ?? '').trim().split(/\s+/);
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
  if (firstName) Object.assign(merged, { firstName, lastName: rest.join(' ') });
  if (profile?.phone) merged.phone = profile.phone;
  return { ...merged, phone: localPhone(merged.phone) };
}
