'use client';
import { Minus, Plus } from 'lucide-react';
export function Quantity({
  value,
  max,
  onChange,
  label = 'Quantity',
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  return (
    <div className="quantity" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value >= Math.min(max, 20)}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
