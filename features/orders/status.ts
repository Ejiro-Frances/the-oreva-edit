export const fulfilmentTransitions: Record<string, string[]> = {
  unfulfilled: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: ['returned'],
  returned: [],
};
export function canFulfil(from: string, to: string, payment: string, test: boolean) {
  return (test || payment === 'paid') && (fulfilmentTransitions[from] || []).includes(to);
}
