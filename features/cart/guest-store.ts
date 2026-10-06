import 'server-only';
import { isFixture } from '@/lib/config';
import { tokenHash } from '@/lib/security';
import { privilegedClient } from '@/lib/supabase/server';
import type { ShoppingRow, ShoppingStore, ShoppingValues } from './state';

const TABLE = 'guest_shopping_state';

/** Fixture mode has no database; guest bags live in this process (e2e runs one server). */
const memory = ((globalThis as { __orevaGuestBags?: Map<string, ShoppingRow> }).__orevaGuestBags ??=
  new Map());

function fixtureStore(hash: string): ShoppingStore {
  return {
    signedIn: false,
    load: async () => (memory.has(hash) ? structuredClone(memory.get(hash)!) : null),
    async update(values: ShoppingValues, previous: string) {
      if (memory.get(hash)?.updated_at !== previous) return false;
      memory.set(hash, structuredClone(values));
      return true;
    },
    async insert(values: ShoppingValues) {
      if (memory.has(hash)) return false;
      memory.set(hash, structuredClone(values));
      return true;
    },
    async remove() {
      memory.delete(hash);
    },
  };
}

function databaseStore(hash: string): ShoppingStore {
  const db = privilegedClient();
  return {
    signedIn: false,
    async load() {
      const { data, error } = await db
        .from(TABLE)
        .select('lines,wishlist,updated_at')
        .eq('guest_hash', hash)
        .maybeSingle();
      if (error) throw error;
      return (data as ShoppingRow | null) ?? null;
    },
    async update(values, previous) {
      const { data, error } = await db
        .from(TABLE)
        .update(values)
        .eq('guest_hash', hash)
        .eq('updated_at', previous)
        .select('guest_hash');
      if (error) throw error;
      return !!data?.length;
    },
    async insert(values) {
      const { data, error } = await db
        .from(TABLE)
        .insert({ guest_hash: hash, ...values })
        .select('guest_hash');
      if (error && error.code === '23505') return false;
      if (error) throw error;
      return !!data?.length;
    },
    async remove() {
      const { error } = await db.from(TABLE).delete().eq('guest_hash', hash);
      if (error) throw error;
    },
  };
}

/** A guest's bag, found by the hash of their token; the token itself is never stored. */
export function guestStore(token: string): ShoppingStore {
  const hash = tokenHash(token);
  return isFixture() ? fixtureStore(hash) : databaseStore(hash);
}

/** Deletes guest bags not changed since `before`; returns how many were removed. */
export async function deleteStaleGuests(before: Date) {
  if (isFixture()) {
    let removed = 0;
    for (const [hash, row] of memory)
      if (row.updated_at < before.toISOString()) {
        memory.delete(hash);
        removed++;
      }
    return removed;
  }
  const { data, error } = await privilegedClient()
    .from(TABLE)
    .delete()
    .lt('updated_at', before.toISOString())
    .select('guest_hash');
  if (error) throw error;
  return data?.length ?? 0;
}
