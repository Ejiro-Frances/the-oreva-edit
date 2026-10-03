import { describe, expect, it } from 'vitest';
import {
  accountNumberError,
  cardErrors,
  digits,
  formatCardNumber,
  formatExpiry,
  passesLuhn,
} from '@/features/checkout/payment-validation';

const now = new Date(2026, 9, 3);
const card = { number: '4084 0840 8408 4081', expiry: '12/28', cvv: '408' };

describe('simulated payment validation', () => {
  it('keeps digits only', () => expect(digits('40a8-4 0')).toBe('40840'));

  it('groups card numbers in fours and caps at 19 digits', () => {
    expect(formatCardNumber('4084084084084081')).toBe('4084 0840 8408 4081');
    expect(formatCardNumber('4084x0840')).toBe('4084 0840');
    expect(digits(formatCardNumber('1'.repeat(25)))).toHaveLength(19);
  });

  it('formats expiry as MM/YY', () => {
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('12')).toBe('12/');
    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('12/289')).toBe('12/28');
  });

  it('checks card numbers with the Luhn algorithm', () => {
    expect(passesLuhn('4084084084084081')).toBe(true);
    expect(passesLuhn('4084084084084082')).toBe(false);
  });

  it('accepts a complete, valid card', () => expect(cardErrors(card, now)).toEqual({}));

  it.each([
    [{ number: '' }, 'number'],
    [{ number: '4084 0840 8408' }, 'number'],
    [{ number: '4084 0840 8408 4082' }, 'number'],
    [{ expiry: '13/28' }, 'expiry'],
    [{ expiry: '09/26' }, 'expiry'],
    [{ expiry: '1/2' }, 'expiry'],
    [{ cvv: '12' }, 'cvv'],
    [{ cvv: '12a' }, 'cvv'],
  ])('rejects %o', (change, field) =>
    expect(cardErrors({ ...card, ...change }, now)).toHaveProperty(field),
  );

  it('accepts a card expiring this month', () =>
    expect(cardErrors({ ...card, expiry: '10/26' }, now)).toEqual({}));

  it('requires a 10-digit NUBAN account number', () => {
    expect(accountNumberError('0123456789')).toBeUndefined();
    expect(accountNumberError('012345678')).toBeDefined();
    expect(accountNumberError('01234567890')).toBeDefined();
    expect(accountNumberError('012345678a')).toBeDefined();
  });
});
