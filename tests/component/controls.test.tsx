// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Quantity } from '@/components/ui/quantity';
import { ProductOptions } from '@/features/catalogue/product-options';
import { ProductSelectionProvider } from '@/features/catalogue/product-selection';
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
  it('requires all option groups and uses the selected length price', async () => {
    const product = products.find((p) => p.slug === 'daybreak-trousers')!;
    render(
      <ProductSelectionProvider product={product}>
        <ProductOptions />
      </ProductSelectionProvider>,
    );
    await userEvent.click(screen.getByLabelText('Colour: Olive'));
    await userEvent.click(screen.getByLabelText('Size: M', { exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your length');
    await userEvent.click(screen.getByLabelText('Length: Long', { exact: true }));
    expect(screen.getByText('₦31,500', { exact: true })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    const variant = product.variants.find(
      (v) =>
        v.attributes.Colour === 'Olive' &&
        v.attributes.Size === 'M' &&
        v.attributes.Length === 'Long',
    )!;
    expect(add).toHaveBeenCalledWith(variant.id, 1, variant.stock);
  });
  it('requires selection and disables sold-out sizes', async () => {
    render(
      <ProductSelectionProvider product={products[0]}>
        <ProductOptions />
      </ProductSelectionProvider>,
    );
    expect(screen.getByLabelText('Colour: Sand')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Size: XL (sold out)')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your size');
    expect(add).not.toHaveBeenCalled();
  });
  it('adds the chosen sellable variant', async () => {
    render(
      <ProductSelectionProvider product={products[0]}>
        <ProductOptions />
      </ProductSelectionProvider>,
    );
    await userEvent.click(screen.getByLabelText('Colour: Sand'));
    await userEvent.click(screen.getByLabelText('Size: M', { exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(add).toHaveBeenCalledWith(products[0].variants[1].id, 1, 8);
  });
  it('lets customers switch to a colour that lacks their previously selected size', async () => {
    const shirt = products[1];
    const product = {
      ...shirt,
      variants: shirt.variants.filter(
        (v) => !(v.attributes.Colour === 'Sage' && v.attributes.Size === 'M'),
      ),
    };
    render(
      <ProductSelectionProvider product={product}>
        <ProductOptions />
      </ProductSelectionProvider>,
    );
    await userEvent.click(screen.getByLabelText('Size: M', { exact: true }));
    await userEvent.click(screen.getByLabelText('Colour: Sage', { exact: true }));
    expect(screen.getByLabelText('Colour: Sage')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Size: M (sold out)')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose your size');
    expect(add).not.toHaveBeenCalled();
  });
  it('resets to the primary colour and adds the alternate colour SKU after choosing a size', async () => {
    const shirt = products[1];
    render(
      <ProductSelectionProvider product={shirt}>
        <ProductOptions />
      </ProductSelectionProvider>,
    );
    await userEvent.click(screen.getByLabelText('Colour: Sage'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear choices' }));
    expect(screen.getByLabelText('Colour: Stone')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByLabelText('Colour: Dusty blue'));
    await userEvent.click(screen.getByLabelText('Size: M', { exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    const variant = shirt.variants.find(
      (v) => v.attributes.Colour === 'Dusty blue' && v.attributes.Size === 'M',
    )!;
    expect(add).toHaveBeenCalledWith(variant.id, 1, variant.stock);
  });
});
