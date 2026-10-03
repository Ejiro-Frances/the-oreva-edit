'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Product } from './types';
import {
  initialSelection,
  selectOption,
  selectPhotograph,
  type ProductSelection,
} from './selection';

type SelectionContext = ProductSelection & {
  product: Product;
  choose: (key: string, value: string) => void;
  viewImage: (image: string) => void;
  setQuantity: (quantity: number) => void;
  reset: () => void;
};
const Context = createContext<SelectionContext | null>(null);

export function ProductSelectionProvider({
  product,
  children,
}: {
  product: Product;
  children: ReactNode;
}) {
  const [selection, setSelection] = useState(() => initialSelection(product));
  return (
    <Context.Provider
      value={{
        ...selection,
        product,
        choose: (key, value) =>
          setSelection((current) => selectOption(product, current, key, value)),
        viewImage: (image) => setSelection((current) => selectPhotograph(product, current, image)),
        setQuantity: (quantity) => setSelection((current) => ({ ...current, quantity })),
        reset: () => setSelection(initialSelection(product)),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useProductSelection() {
  const context = useContext(Context);
  if (!context) throw new Error('Product controls require a ProductSelectionProvider');
  return context;
}
