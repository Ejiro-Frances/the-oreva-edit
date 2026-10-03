'use client';
import { useState } from 'react';
import { CheckCircle2, CreditCard, Landmark, Loader2, Lock } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { money } from '@/lib/money';
import {
  accountNumberError,
  cardErrors,
  digits,
  formatCardNumber,
  formatExpiry,
} from './payment-validation';

const banks = [
  'Access Bank',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank',
  'Guaranty Trust Bank',
  'Kuda Bank',
  'Moniepoint MFB',
  'OPay',
  'PalmPay',
  'Polaris Bank',
  'Stanbic IBTC Bank',
  'Sterling Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa',
  'Wema Bank',
  'Zenith Bank',
];

type Method = 'card' | 'bank';
type Step = 'details' | 'processing' | 'success';

// Payment is simulated: card and account numbers stay in this component's state and are
// never sent anywhere. `onPay` only creates the order.
export function PaymentDialog({
  open,
  amount,
  email,
  onClose,
  onPay,
  onDone,
}: {
  open: boolean;
  amount: number;
  email: string;
  onClose: () => void;
  onPay: () => Promise<{ number: string } | { error: string }>;
  onDone: (number: string) => void;
}) {
  const [method, setMethod] = useState<Method>('card');
  const [step, setStep] = useState<Step>('details');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [bank, setBank] = useState({ name: '', account: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [order, setOrder] = useState('');

  const validate = () => {
    const next: Record<string, string> = method === 'card' ? { ...cardErrors(card) } : {};
    if (method === 'bank') {
      if (!bank.name) next.bank = 'Choose your bank';
      const account = accountNumberError(bank.account);
      if (account) next.account = account;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure('');
    if (!validate()) return;
    setStep('processing');
    const [result] = await Promise.all([onPay(), new Promise((r) => setTimeout(r, 1500))]);
    if ('error' in result) {
      setFailure(result.error);
      setStep('details');
      return;
    }
    forget();
    setOrder(result.number);
    setStep('success');
  };

  const forget = () => {
    setCard({ number: '', expiry: '', cvv: '' });
    setBank({ name: '', account: '' });
    setErrors({});
    setFailure('');
  };

  const close = () => {
    if (step === 'processing') return;
    if (step === 'success') return onDone(order);
    forget();
    onClose();
  };

  const describe = (id: string) => (errors[id] ? `${id}-error` : undefined);

  return (
    <Dialog
      title={step === 'success' ? 'Payment successful' : 'Payment'}
      open={open}
      onClose={close}
    >
      {step === 'success' ? (
        <div className="pay-success" role="status">
          <CheckCircle2 size={44} aria-hidden />
          <p className="pay-success-amount">{money(amount)}</p>
          <p>
            Your order <strong>{order}</strong> has been placed. We’ve sent the details to{' '}
            <strong>{email}</strong>.
          </p>
          <p className="pay-success-note">
            No money was removed from your account. This payment was simulated and your card or bank
            details were not stored.
          </p>
          <button type="button" className="button full" onClick={() => onDone(order)}>
            View your order
          </button>
        </div>
      ) : (
        <form className="pay" noValidate onSubmit={pay} autoComplete="off">
          <div className="pay-summary">
            <span>{email}</span>
            <span>
              Pay <strong>{money(amount)}</strong>
            </span>
          </div>
          <fieldset className="pay-methods" disabled={step === 'processing'}>
            <legend>Pay with</legend>
            {(
              [
                ['card', 'Card', CreditCard],
                ['bank', 'Bank account', Landmark],
              ] as const
            ).map(([value, label, Icon]) => (
              <label key={value} className={method === value ? 'active' : ''}>
                <input
                  type="radio"
                  name="method"
                  value={value}
                  checked={method === value}
                  onChange={() => {
                    setMethod(value);
                    setErrors({});
                  }}
                />
                <Icon size={18} aria-hidden />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="pay-fields" disabled={step === 'processing'}>
            {method === 'card' ? (
              <>
                <p className="caption">Enter your card details to pay.</p>
                <Field id="card-number" label="Card number" error={errors.number} required>
                  <input
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0000 0000 0000 0000"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                    aria-required
                    aria-invalid={!!errors.number}
                    aria-describedby={errors.number ? 'card-number-error' : undefined}
                  />
                </Field>
                <div className="pay-row">
                  <Field id="card-expiry" label="Expiry" error={errors.expiry} required>
                    <input
                      id="card-expiry"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="MM/YY"
                      maxLength={5}
                      value={card.expiry}
                      onChange={(e) => {
                        const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith(
                          'delete',
                        );
                        const d = digits(e.target.value).slice(0, 4);
                        const expiry = deleting && d.length <= 2 ? d : formatExpiry(e.target.value);
                        setCard({ ...card, expiry });
                      }}
                      aria-required
                      aria-invalid={!!errors.expiry}
                      aria-describedby={errors.expiry ? 'card-expiry-error' : undefined}
                    />
                  </Field>
                  <Field id="card-cvv" label="CVV" error={errors.cvv} required>
                    <input
                      id="card-cvv"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="123"
                      maxLength={4}
                      value={card.cvv}
                      onChange={(e) => setCard({ ...card, cvv: digits(e.target.value) })}
                      aria-required
                      aria-invalid={!!errors.cvv}
                      aria-describedby={errors.cvv ? 'card-cvv-error' : undefined}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <p className="caption">Choose your bank to start the payment.</p>
                <Field id="bank" label="Bank" error={errors.bank} required>
                  <select
                    id="bank"
                    value={bank.name}
                    onChange={(e) => setBank({ ...bank, name: e.target.value })}
                    aria-required
                    aria-invalid={!!errors.bank}
                    aria-describedby={describe('bank')}
                  >
                    <option value="">Select a bank</option>
                    {banks.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Field>
                <Field id="account" label="Account number" error={errors.account} required>
                  <input
                    id="account"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0123456789"
                    maxLength={10}
                    value={bank.account}
                    onChange={(e) =>
                      setBank({ ...bank, account: digits(e.target.value).slice(0, 10) })
                    }
                    aria-required
                    aria-invalid={!!errors.account}
                    aria-describedby={describe('account')}
                  />
                </Field>
              </>
            )}
          </fieldset>
          <p className="pay-debit">
            You’ll be debited <strong>{money(amount)}</strong>
          </p>
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          <button
            className="button full"
            disabled={step === 'processing'}
            aria-busy={step === 'processing'}
          >
            {step === 'processing' ? (
              <>
                <Loader2 className="spinner" aria-hidden />
                Processing payment…
              </>
            ) : (
              `Pay ${money(amount)}`
            )}
          </button>
          <p className="pay-secure">
            <Lock size={12} aria-hidden /> Secured checkout
          </p>
        </form>
      )}
    </Dialog>
  );
}
