import type { SupabaseClient } from '@supabase/supabase-js';
import type { CartLine } from '@/features/catalogue/types';

export type FakeRow = {
  user_id: string;
  lines: CartLine[];
  wishlist: string[];
  updated_at: string;
};

/**
 * Just enough of the supabase-js query builder for shopping_state. `beforeWrite` runs between
 * this device's read and its write, which is where another device's change would land: once by
 * default, or before every write with `{ every: true }`. `writes()` counts write attempts.
 */
export function fakeShoppingDb(
  initial: FakeRow | null,
  beforeWrite?: (row: FakeRow | null) => FakeRow | null,
  { every = false }: { every?: boolean } = {},
) {
  let row = initial;
  let pending = beforeWrite;
  let attempts = 0;
  const interleave = () => {
    attempts++;
    if (pending) {
      row = pending(row);
      if (!every) pending = undefined;
    }
  };
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row && structuredClone(row), error: null }),
        }),
      }),
      update: (values: Partial<FakeRow>) => ({
        eq: () => ({
          eq: (_column: string, expected: string) => ({
            select: async () => {
              interleave();
              if (!row || row.updated_at !== expected) return { data: [], error: null };
              row = { ...row, ...values };
              return { data: [{ user_id: row.user_id }], error: null };
            },
          }),
        }),
      }),
      delete: () => ({
        eq: async () => {
          row = null;
          return { error: null };
        },
      }),
      insert: (values: FakeRow) => ({
        select: async () => {
          interleave();
          if (row) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          row = values;
          return { data: [{ user_id: values.user_id }], error: null };
        },
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, row: () => row, writes: () => attempts };
}
