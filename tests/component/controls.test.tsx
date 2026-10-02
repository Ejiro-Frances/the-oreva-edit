// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Quantity } from '@/components/ui/quantity';
import { ProductOptions } from '@/features/catalogue/product-options';
import { products } from '@/features/catalogue/fixtures';
const add = vi.fn(() => true);
vi.mock('@/features/cart/provider', () => ({
  useShopping: () => ({ add, ready: true, notify: vi.fn(), wishlist: [], toggle: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('quantity controls', () => {
  it('prevents decreasing below one and increasing past stock', () => {
    render(<Quantity value={1} max={1} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled();
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
  });
  it('reports the next quantity on interaction', async () => {
    const change = vi.fn();
    render(<Quantity value={2} max={5} onChange={change} />);
    await userEvent.click(screen.getByLabelText('Increase quantity'));
    expect(change).toHaveBeenCalledWith(3);
  });
});
describe('product options', () => {
  it('requires selection and disables sold-out sizes', async () => {
    render(<ProductOptions product={products[0]} />);
    expect(screen.getByLabelText('Size: XL (sold out)')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your colour and size');
    expect(add).not.toHaveBeenCalled();
  });
  it('adds the chosen sellable variant', async () => {
    render(<ProductOptions product={products[0]} />);
    await userEvent.click(screen.getByLabelText('Colour: Sand'));
    await userEvent.click(screen.getByLabelText('Size: M', { exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(add).toHaveBeenCalledWith(products[0].variants[1].id, 1, 8);
  });
});
