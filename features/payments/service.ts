export type PaymentStatus =
  'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export interface PaymentProvider {
  initiate(input: {
    orderId: string;
    amountKobo: number;
    currency: 'NGN';
    idempotencyKey: string;
  }): Promise<{ reference: string; redirectUrl: string }>;
  verify(
    reference: string,
  ): Promise<{ status: PaymentStatus; amountKobo: number; currency: string }>;
  verifyWebhook(rawBody: Uint8Array, signature: string): boolean;
  refund(
    reference: string,
    amountKobo: number,
    idempotencyKey: string,
  ): Promise<{ reference: string }>;
}
export const paymentsConnected = false;
