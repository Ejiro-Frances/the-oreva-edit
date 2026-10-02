'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checkoutSchema, type CheckoutInput } from '@/lib/validation';
import { states } from '@/lib/config';
import { useShopping } from '@/features/cart/provider';
import type { Product, DeliveryZone } from '@/features/catalogue/types';
import { money } from '@/lib/money';
import { Field } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
export function CheckoutForm({
  products,
  zones,
  enabled,
  email = '',
  addresses = [],
}: {
  products: Product[];
  zones: DeliveryZone[];
  enabled: boolean;
  email?: string;
  addresses?: { id: string; label: string; details: Omit<CheckoutInput, 'email' | 'acceptTest'> }[];
}) {
  const { lines, clear, ready } = useShopping();
  const router = useRouter();
  const key = useRef<string | null>(null);
  const submitting = useRef(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email,
      firstName: '',
      lastName: '',
      phone: '',
      city: '',
      address: '',
      lga: '',
      landmark: '',
      instructions: '',
    },
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
  async function submit(contact: CheckoutInput) {
    if (submitting.current) return;
    submitting.current = true;
    setServerError('');
    key.current ||= crypto.randomUUID();
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, items: lines, idempotencyKey: key.current }),
      });
      const result = await response.json();
      if (!response.ok) {
        setServerError(result.error || 'Your order could not be created.');
        return;
      }
      clear();
      router.push(`/order-confirmation/${result.number}`);
    } catch {
      setServerError(
        'We couldn’t reach the store. Your details are still here. Try again when you’re connected.',
      );
    } finally {
      submitting.current = false;
    }
  }
  const input = (
    name: Exclude<keyof CheckoutInput, 'acceptTest' | 'state' | 'instructions'>,
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
    >
      <input
        id={name}
        type={type}
        autoComplete={autoComplete}
        {...register(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
    </Field>
  );
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
        <div className="notice-box">
          <strong>Development checkout · No payment collected</strong>
          <p>
            This creates an unpaid test order. Use test details only. Nothing will be charged or
            delivered.
          </p>
        </div>
        <section className="form-section">
          <h2>01 / Your details</h2>
          <div className="form-grid">
            {input('email', 'Email address', 'email', 'email', true)}
            {input('phone', 'Nigerian mobile number', 'tel', 'tel', true)}
          </div>
          <p className="caption" style={{ marginTop: 15 }}>
            Have an account?{' '}
            <Link href="/login?next=/checkout" className="text-link">
              Sign in
            </Link>
          </p>
        </section>
        <section className="form-section">
          <h2>02 / Where it’s going</h2>
          {addresses.length > 0 && (
            <Field id="saved-address" label="Use a saved address">
              <select
                id="saved-address"
                defaultValue=""
                onChange={(e) => {
                  const a = addresses.find((a) => a.id === e.target.value);
                  if (a)
                    Object.entries(a.details).forEach(([k, v]) =>
                      setValue(k as keyof CheckoutInput, v, { shouldValidate: true }),
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
            <Field id="state" label="State / FCT" error={errors.state?.message}>
              <select
                id="state"
                {...register('state')}
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
              Delivery is not configured for this state yet. Current test zones:{' '}
              {zones.map((z) => z.states.join(', ')).join('; ')}.
            </p>
          )}
        </section>
        <section className="form-section">
          <h2>03 / Test order</h2>
          <p className="muted">Payment is not connected. This order will be marked unpaid.</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              {...register('acceptTest')}
              aria-describedby={errors.acceptTest ? 'acceptTest-error' : undefined}
            />
            I understand this is an unpaid test order with no delivery.
          </label>
          {errors.acceptTest && (
            <p id="acceptTest-error" className="field-error" role="alert">
              {errors.acceptTest.message}
            </p>
          )}
          <p className="caption">
            Read our{' '}
            <Link href="/privacy" className="text-link">
              privacy notice
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-link">
              terms
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
            {isSubmitting ? 'Creating your test order…' : 'Place unpaid test order'}
          </button>
          {!enabled && (
            <p className="field-error">Order creation is disabled for this environment.</p>
          )}
        </section>
      </form>
      <aside className="checkout-summary">
        <h2>Your edit.</h2>
        {resolved.map((l) => (
          <div key={l.variantId} className="checkout-summary-line">
            {l.product && <Image src={l.product.images[0]} alt="" width={60} height={80} />}
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
          <span>Delivery {zone?.fixture ? '(test rate)' : ''}</span>
          <span>{zone ? money(delivery) : 'Choose a state'}</span>
        </div>
        <div className="total-row">
          <strong>Estimated total</strong>
          <strong>{money(subtotal + delivery)}</strong>
        </div>
        <p className="caption">
          All prices in NGN. Prices and availability are checked again when you place your test
          order.
        </p>
      </aside>
    </div>
  );
}
