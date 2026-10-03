export const digits = (value: string) => value.replace(/\D/g, '');

export function formatCardNumber(value: string) {
  return digits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value: string) {
  const d = digits(value).slice(0, 4);
  return d.length >= 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function passesLuhn(number: string) {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let n = Number(number[number.length - 1 - i]);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return number.length > 0 && sum % 10 === 0;
}

export type CardInput = { number: string; expiry: string; cvv: string };

export function cardErrors(card: CardInput, now = new Date()) {
  const errors: Partial<Record<keyof CardInput, string>> = {};
  const number = digits(card.number);
  if (number.length < 13 || number.length > 19 || !passesLuhn(number))
    errors.number = 'Enter a valid card number';
  const match = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  const month = match ? Number(match[1]) : 0;
  const year = match ? 2000 + Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) errors.expiry = 'Enter the expiry date as MM/YY';
  else if (year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1)
    errors.expiry = 'This card has expired';
  if (!/^\d{3,4}$/.test(card.cvv)) errors.cvv = 'Enter the 3 or 4 digits on the back';
  return errors;
}

export function accountNumberError(account: string) {
  return /^\d{10}$/.test(account) ? undefined : 'Enter your 10-digit account number';
}
