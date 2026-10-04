'use client';
import { variantImage } from '@/features/catalogue/selection';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checkoutSchema, localPhone, type CheckoutInput } from '@/lib/validation';
import { states } from '@/lib/config';
import { useShopping } from '@/features/cart/provider';
import type { Product, DeliveryZone } from '@/features/catalogue/types';
import { money } from '@/lib/money';
import { Field } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { PaymentDialog } from './payment';
export function CheckoutForm({
  products,
  zones,
  enabled,
  signedInAs,
  defaults,
  addresses = [],
  selectedAddress = '',
}: {
  products: Product[];
  zones: DeliveryZone[];
  enabled: boolean;
  signedInAs?: string;
  defaults: Partial<CheckoutInput>;
  addresses?: { id: string; label: string; details: Omit<CheckoutInput, 'email'> }[];
  selectedAddress?: string;
}) {
  const { lines, clear, ready } = useShopping();
  const router = useRouter();
  const key = useRef<string | null>(null);
  const submitting = useRef(false);
  const [serverError, setServerError] = useState('');
  const [contact, setContact] = useState<CheckoutInput | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: defaults,
  });
  const selectedState = useWatch({ control, name: 'state' });
  const zone = zones.find((z) => z.active && z.states.includes(selectedState));
  const resolved = lines.map((l) => {
    const p = products.find((p) => p.variants.some((v) => v.id === l.variantId));
    const v = p?.variants.find((v) => v.id === l.variantId);
    return { ...l, product: p, variant: v };
  });
  const subtotal = resolved.reduce(
    (n, l) => n + (l.variant?.price ?? l.product?.price ?? 0) * l.quantity,
    0,
  );
  const delivery = zone
    ? zone.free_threshold !== null && subtotal >= zone.free_threshold
      ? 0
      : zone.rate
    : 0;
  function submit(details: CheckoutInput) {
    setServerError('');
    if (!zone) {
      setServerError('Choose a state we deliver to before paying.');
      return;
    }
    setContact(details);
  }
  // Creates the order once the simulated payment step is confirmed.
  async function createOrder(): Promise<{ number: string } | { error: string }> {
    if (submitting.current || !contact) return { error: 'Your order is already being placed.' };
    submitting.current = true;
    key.current ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, items: lines, idempotencyKey: key.current }),
      });
      const result = await response.json();
      if (!response.ok) return { error: result.error || 'Your order could not be placed.' };
      return { number: result.number };
    } catch {
      return {
        error:
          'We couldn’t reach the store. Your details are still here. Try again when you’re connected.',
      };
    } finally {
      submitting.current = false;
    }
  }
  function finish(number: string) {
    router.push(`/order-confirmation/${number}`);
    clear();
  }
  const optional = new Set<keyof CheckoutInput>(['lga', 'landmark', 'instructions']);
  const input = (
    name: Exclude<keyof CheckoutInput, 'state' | 'instructions'>,
    label: string,
    autoComplete?: string,
    type = 'text',
    full = false,
  ) => (
    <Field
      key={name}
      id={name}
      label={label}
      error={errors[name]?.message}
      className={full ? 'span-2' : ''}
      required={!optional.has(name)}
    >
      <input
        id={name}
        type={type}
        autoComplete={autoComplete}
        {...register(name)}
        {...(name === 'phone' && phoneInput)}
        aria-required={!optional.has(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
    </Field>
  );
  const phoneField = register('phone');
  const phoneInput = {
    inputMode: 'numeric' as const,
    maxLength: 11,
    placeholder: '08012345678',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
      return phoneField.onChange(e);
    },
  };
  if (!ready) return <p role="status">Preparing your checkout…</p>;
  if (!lines.length)
    return (
      <EmptyState
        title="Your bag is waiting for a good find."
        description="Add a piece to your bag to begin checkout."
      />
    );
  return (
    <div className="checkout-layout">
      <form noValidate onSubmit={handleSubmit(submit)}>
        <section className="form-section">
          <h2>01 / Your details</h2>
          <p className="caption" style={{ marginBottom: 15 }}>
            Fields marked <span className="required-mark">*</span> are required.
          </p>
          <div className="form-grid">
            {input('email', 'Email address', 'email', 'email', true)}
            {input('phone', 'Nigerian mobile number', 'tel', 'tel', true)}
          </div>
          <p className="caption" style={{ marginTop: 15 }}>
            {signedInAs ? (
              <>Signed in as {signedInAs}</>
            ) : (
              <>
                Have an account?{' '}
                <Link href="/login?next=/checkout" className="text-link">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </section>
        <section className="form-section">
          <h2>02 / Where it’s going</h2>
          {addresses.length > 0 && (
            <Field id="saved-address" label="Use a saved address">
              <select
                id="saved-address"
                defaultValue={selectedAddress}
                onChange={(e) => {
                  const a = addresses.find((a) => a.id === e.target.value);
                  if (a)
                    Object.entries(a.details).forEach(([k, v]) =>
                      setValue(k as keyof CheckoutInput, k === 'phone' ? localPhone(v) : v, {
                        shouldValidate: true,
                      }),
                    );
                }}
              >
                <option value="">Enter a new address</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="form-grid">
            {input('firstName', 'First name', 'given-name')}
            {input('lastName', 'Last name', 'family-name')}
            <Field id="state" label="State / FCT" error={errors.state?.message} required>
              <select
                id="state"
                {...register('state')}
                aria-required
                aria-invalid={!!errors.state}
                aria-describedby={errors.state ? 'state-error' : undefined}
              >
                <option value="">Choose a state</option>
                {states.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            {input('lga', 'LGA (optional)', 'address-level2')}
            {input('city', 'City or town', 'address-level2', 'text', true)}
            {input('address', 'Delivery address', 'street-address', 'text', true)}
            {input('landmark', 'Nearest landmark (optional)', undefined, 'text', true)}
            <Field
              id="instructions"
              label="Delivery instructions (optional)"
              error={errors.instructions?.message}
              className="span-2"
            >
              <textarea id="instructions" rows={3} {...register('instructions')} />
            </Field>
          </div>
          {selectedState && !zone && (
            <p role="alert" className="field-error">
              We don’t deliver to this state yet. We currently deliver to{' '}
              {zones
                .filter((z) => z.active)
                .map((z) => z.states.join(', '))
                .join('; ')}
              .
            </p>
          )}
        </section>
        <section className="form-section">
          <h2>03 / Order</h2>
          <p className="caption">
            By placing your order you agree to our{' '}
            <Link href="/terms" className="text-link">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-link">
              privacy notice
            </Link>
            .
          </p>
          {serverError && (
            <p className="field-error" role="alert" style={{ marginBlock: 20 }}>
              {serverError}
            </p>
          )}
          <button
            className="button full"
            style={{ marginTop: 20 }}
            disabled={isSubmitting || !enabled}
          >
            {isSubmitting
              ? 'Checking your details…'
              : `Continue to payment · ${money(subtotal + delivery)}`}
          </button>
          {!enabled && (
            <p className="field-error">
              Checkout is temporarily unavailable. Please try again later.
            </p>
          )}
        </section>
      </form>
      <PaymentDialog
        open={!!contact}
        amount={subtotal + delivery}
        email={contact?.email ?? ''}
        onClose={() => setContact(null)}
        onPay={createOrder}
        onDone={finish}
      />
      <aside className="checkout-summary">
        <h2>Your edit.</h2>
        {resolved.map((l) => (
          <div key={l.variantId} className="checkout-summary-line">
            {l.product && (
              <Image src={variantImage(l.product, l.variant)} alt="" width={60} height={80} />
            )}
            <div>
              {l.product?.name || 'Unavailable item'}
              <p>
                {Object.values(l.variant?.attributes || {}).join(' / ')} · Qty {l.quantity}
              </p>
            </div>
            <span>{money((l.variant?.price ?? l.product?.price ?? 0) * l.quantity)}</span>
          </div>
        ))}
        <div className="total-row">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="total-row">
          <span>Delivery</span>
          <span>{zone ? money(delivery) : 'Choose a state'}</span>
        </div>
        <div className="total-row">
          <strong>Estimated total</strong>
          <strong>{money(subtotal + delivery)}</strong>
        </div>
        <p className="caption">
          All prices in NGN. Prices and availability are confirmed when you place your order.
        </p>
      </aside>
    </div>
  );
}
