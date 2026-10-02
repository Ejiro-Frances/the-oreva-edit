# Payment integration — deliberately deferred

There is no payment gateway, card form, simulated paid state or card data collection. Checkout creates unpaid test orders when explicitly enabled. Public production must set ALLOW_TEST_ORDERS=false.

The future boundary is features/payments/service.ts. Implement PaymentProvider for Paystack in a server-only module. The browser must receive only a redirect URL/reference, never a provider secret or trusted price.

1. Replace test-order creation with an atomic pending order + expiring variant reservation transaction. Define reservation expiry and abandonment release. Current test orders decrement test inventory immediately; do not reuse that policy for unpaid live checkout.
2. Initiate payment against the order's database total in kobo and NGN. Persist an idempotency key and provider reference in payments; never accept a client total.
3. A return URL is an untrusted signal. Verify payment server-to-server and compare amount, currency, provider reference, order identity and merchant account before updating payment_status.
4. Accept provider webhooks using their raw request body. Verify the current official provider signature scheme with constant-time comparison, reject malformed/replayed events, record a unique provider event ID, and acknowledge only after durable processing.
5. Handle return/webhook races with transaction locks and unique constraints. One payment must not fulfil two orders. Fulfilment must remain independent of payment.
6. Confirm reserved stock only once. Resolve expired reservation / late payment with an explicit business policy; never silently oversell or mark a refund complete without provider confirmation.
7. Add reconciliation for pending/unknown payments and unmatched amounts. Test timeout, duplicate webhook, wrong amount/currency, failed verification, retries and partial refund.
8. Implement refund records, amount limits and audited transitions only after business/legal rules are approved.

No provider SDK is installed. Verify Paystack's official documentation and webhook details at the time of implementation. Owner business verification, provider keys, callback domains and operational reconciliation approval remain required.
