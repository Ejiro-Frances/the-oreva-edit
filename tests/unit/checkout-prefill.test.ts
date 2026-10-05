import { describe, expect, it } from 'vitest';
import { checkoutDefaults } from '@/features/checkout/prefill';

const blank = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  city: '',
  address: '',
  lga: '',
  landmark: '',
  instructions: '',
};

const saved = {
  firstName: 'Ada',
  lastName: 'Obi',
  phone: '+2348098765432',
  state: 'Lagos' as const,
  lga: 'Ikeja',
  city: 'Ikeja',
  address: '12 Allen Avenue, Ikeja',
  landmark: 'Near the bank',
  instructions: 'Call on arrival',
};

describe('checkout prefill', () => {
  it('is empty for guests', () => expect(checkoutDefaults({})).toEqual(blank));

  it('uses the profile name, email and phone in local format', () => {
    expect(
      checkoutDefaults({
        email: 'tolu@example.com',
        profile: { display_name: 'Tolu Ade Bello', phone: '+2348012345678' },
      }),
    ).toEqual({
      ...blank,
      email: 'tolu@example.com',
      firstName: 'Tolu',
      lastName: 'Ade Bello',
      phone: '08012345678',
    });
  });

  it('prefers stored first and last names over splitting the display name', () => {
    const d = checkoutDefaults({
      profile: {
        display_name: 'Mary Jane Bello',
        first_name: 'Mary Jane',
        last_name: 'Bello',
        phone: '',
      },
    });
    expect([d.firstName, d.lastName]).toEqual(['Mary Jane', 'Bello']);
  });

  it('leaves the last name empty for a single-word name', () => {
    const d = checkoutDefaults({ profile: { display_name: '  Tolu ', phone: '' } });
    expect([d.firstName, d.lastName, d.phone]).toEqual(['Tolu', '', '']);
  });

  it('fills delivery fields from the saved address, preferring profile contact details', () => {
    expect(
      checkoutDefaults({
        email: 'tolu@example.com',
        profile: { display_name: 'Tolu Bello', phone: '08012345678' },
        address: saved,
      }),
    ).toEqual({
      ...saved,
      email: 'tolu@example.com',
      firstName: 'Tolu',
      lastName: 'Bello',
      phone: '08012345678',
    });
  });

  it('falls back to the saved address when the profile has no name or phone', () => {
    const d = checkoutDefaults({ profile: { display_name: '', phone: '' }, address: saved });
    expect([d.firstName, d.lastName, d.phone]).toEqual(['Ada', 'Obi', '08098765432']);
  });
});
