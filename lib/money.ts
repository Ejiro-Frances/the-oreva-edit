export function money(kobo: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: kobo % 100 === 0 ? 0 : 2,
  }).format(kobo / 100);
}
export function calculateTotals(lines: { price: number; quantity: number }[], delivery = 0) {
  if (
    !Number.isSafeInteger(delivery) ||
    delivery < 0 ||
    lines.some(
      (l) =>
        !Number.isSafeInteger(l.price) ||
        l.price < 0 ||
        !Number.isInteger(l.quantity) ||
        l.quantity < 1 ||
        l.quantity > 20,
    )
  )
    throw new Error('Invalid price or quantity');
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  if (!Number.isSafeInteger(subtotal + delivery)) throw new Error('Total exceeds supported amount');
  return { subtotal, delivery, total: subtotal + delivery };
}
