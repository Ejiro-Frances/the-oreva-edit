'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
/** A single password field with a show/hide toggle instead of a "confirm password" field. */
export function PasswordInput({
  id,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        id={id}
        name="password"
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        aria-required
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
