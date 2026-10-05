/**
 * Email and password sign-in helpers shared by the auth routes.
 *
 * Supabase "Confirm email" is off, so customers can sign in straight away and
 * Supabase marks every address confirmed. Ownership is tracked separately in
 * profiles.email_verified_at, set only when an emailed link is opened.
 */

export const CONFIRM_PATH = '/auth/confirm';

const destinations = {
  email: '/account?verified=1',
  recovery: '/reset-password',
} as const;

export type EmailLinkType = keyof typeof destinations;

/** Reads a link from a Supabase email template; anything unexpected is rejected. */
export function confirmLink(params: URLSearchParams) {
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (!tokenHash || !type || !Object.hasOwn(destinations, type)) return null;
  const linkType = type as EmailLinkType;
  return { tokenHash, type: linkType, destination: destinations[linkType] };
}

const messages: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  user_already_exists: 'An account already exists for this email.',
  email_exists: 'An account already exists for this email.',
  weak_password: 'Please choose a stronger password.',
  same_password: 'Choose a password you haven’t used for this account.',
  over_email_send_rate_limit: 'We’ve just sent you an email. Please wait a minute and try again.',
  over_request_rate_limit: 'Please wait a little before trying again.',
  email_address_invalid: 'Enter a valid email address.',
  otp_expired: 'This link has expired. Please request a new one.',
};

/** Maps Supabase Auth error codes to customer-facing copy; raw provider text is never shown. */
export function authErrorMessage(code: string | undefined) {
  return (code && messages[code]) || 'Something went wrong. Please try again.';
}
