import type { ReactNode } from 'react';
export function Field({
  id,
  label,
  error,
  children,
  className = '',
  required = false,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className={required ? 'required' : undefined}>
        {label}
      </label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
