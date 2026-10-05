import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { products } from '@/features/catalogue/fixtures';
let db: PGlite;
const customer = '50000000-0000-4000-8000-000000000001',
  other = '50000000-0000-4000-8000-000000000002',
  admin = '50000000-0000-4000-8000-000000000003';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create table auth.identities(user_id uuid,provider text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`,
  );
  for (const file of (await readdir('supabase/migrations')).sort()) {
    const sql = (await readFile('supabase/migrations/' + file, 'utf8')).replace(
      'create extension if not exists pgcrypto;',
      '',
    );
    await db.exec(sql);
  }
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
  await db.exec(
    `insert into auth.users(id,email)values('${customer}','customer@example.test'),('${other}','other@example.test'),('${admin}','admin@example.test');insert into public.user_roles values('${admin}','admin');`,
  );
});
afterAll(async () => {
  await db?.close();
});
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}';`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role;reset request.jwt.claim.sub;');
  }
}
describe('PostgreSQL schema, transactions and RLS', () => {
  it('allows anonymous active catalogue reads and hides profiles', async () => {
    await db.exec('set role anon');
    try {
      expect((await db.query('select id from public.catalogue')).rows.length).toBe(products.length);
      await expect(db.query('select id from public.profiles')).rejects.toThrow('permission denied');
    } finally {
      await db.exec('reset role');
    }
  });
  it('seeds the men’s range and accessory category parents', async () => {
    const men = await db.query<{ slug: string }>(
      "select slug from public.catalogue where audience='men'",
    );
    expect(men.rows).toHaveLength(12);
    expect(men.rows.map((p) => p.slug)).toEqual(
      expect.arrayContaining(['everyday-boxer-briefs', 'everyday-singlet', 'city-varsity-jacket']),
    );
    const children = await db.query<{ slug: string; parent: string }>(
      "select c.slug, p.slug as parent from public.categories c join public.categories p on p.id=c.parent_id where c.slug in ('caps','sunglasses') order by c.slug",
    );
    expect(children.rows).toEqual([
      { slug: 'caps', parent: 'accessories' },
      { slug: 'sunglasses', parent: 'accessories' },
    ]);
  });
  it('does not permit customer role escalation', async () => {
    await expect(
      asUser(customer, `insert into public.user_roles values('${customer}','admin')`),
    ).rejects.toThrow();
    expect((await asUser(customer, 'select public.is_admin() admin')).rows[0]).toEqual({
      admin: false,
    });
  });
  it('hides another customer’s address', async () => {
    await asUser(
      customer,
      `insert into public.addresses(user_id,label,details)values('${customer}','Test','{}')`,
    );
    expect((await asUser(other, 'select * from public.addresses')).rows).toHaveLength(0);
  });
  it('rejects direct customer order and stock mutations', async () => {
    await expect(
      asUser(customer, 'update public.product_variants set stock=999 returning id'),
    ).rejects.toThrow();
    await expect(
      asUser(
        customer,
        "select public.create_test_order('[]','{}',gen_random_uuid(),repeat('a',64),null)",
      ),
    ).rejects.toThrow();
  });
  it('creates authoritative snapshots, decrements stock, and is idempotent', async () => {
    const args = `'[{"variantId":"30000000-0000-4000-8000-000000000001","quantity":2}]','{"acceptTest":true,"state":"Lagos","email":"customer@example.test","firstName":"Test","lastName":"Customer","address":"10 Test Street","city":"Test City"}','60000000-0000-4000-8000-000000000001',repeat('a',64),'${customer}'`;
    const first = await db.query(`select public.create_test_order(${args}) number`);
    const second = await db.query(`select public.create_test_order(${args}) number`);
    expect(first.rows).toEqual(second.rows);
    expect((await db.query('select total,payment_status from public.orders')).rows[0]).toEqual({
      total: 7950000,
      payment_status: 'unpaid',
    });
    expect(
      (
        await db.query(
          "select stock from public.product_variants where id='30000000-0000-4000-8000-000000000001'",
        )
      ).rows[0],
    ).toEqual({ stock: 5 });
    expect((await db.query('select * from public.email_outbox')).rows).toHaveLength(1);
  });
  it('keeps orders and snapshots private to their owner', async () => {
    expect((await asUser(customer, 'select id from public.orders')).rows).toHaveLength(1);
    expect((await asUser(other, 'select id from public.orders')).rows).toHaveLength(0);
    expect((await asUser(other, 'select id from public.order_items')).rows).toHaveLength(0);
  });
  it('rolls back invalid stock requests', async () => {
    await expect(
      db.query(
        `select public.create_test_order('[{"variantId":"30000000-0000-4000-8000-000000000001","quantity":10}]','{"acceptTest":true,"state":"Lagos"}',gen_random_uuid(),repeat('b',64),null)`,
      ),
    ).rejects.toThrow('stock');
    expect((await db.query('select id from public.orders')).rows).toHaveLength(1);
  });
  it('preserves snapshot names after catalogue edits', async () => {
    await db.exec(
      "update public.products set name='Changed product name' where id='20000000-0000-4000-8000-000000000001'",
    );
    expect((await db.query('select name from public.order_items')).rows[0]).toEqual({
      name: 'The Sade midi dress',
    });
  });
  it('prevents category cycles', async () => {
    await db.exec(
      "update public.categories set parent_id='10000000-0000-4000-8000-000000000001' where id='10000000-0000-4000-8000-000000000002'",
    );
    await expect(
      db.exec(
        "update public.categories set parent_id='10000000-0000-4000-8000-000000000002' where id='10000000-0000-4000-8000-000000000001'",
      ),
    ).rejects.toThrow('cycle');
  });
  it('requires administrator role and valid fulfilment sequence', async () => {
    const { rows } = await db.query<{ id: string }>('select id from public.orders limit 1');
    await expect(
      asUser(customer, `select public.update_fulfilment('${rows[0].id}','processing','')`),
    ).rejects.toThrow('Forbidden');
    await expect(
      asUser(admin, `select public.update_fulfilment('${rows[0].id}','shipped','')`),
    ).rejects.toThrow('transition');
    await asUser(
      admin,
      `select public.update_fulfilment('${rows[0].id}','processing','Test processing')`,
    );
    expect((await db.query('select fulfilment_status from public.orders')).rows[0]).toEqual({
      fulfilment_status: 'processing',
    });
  });
});
describe('Administrator publishing and moderation', () => {
  it('creates and edits a draft with optimistic stock checks', async () => {
    const input = {
      name: 'Integration cotton shirt',
      slug: 'integration-cotton-shirt',
      description: 'Controlled integration fixture',
      short_description: 'Test shirt',
      category_id: '10000000-0000-4000-8000-000000000001',
      audience: 'men',
      price: 1200000,
      compare_at: null,
      status: 'draft',
      tags: [],
      featured: false,
      details: [],
      care: 'Test care',
      seo_title: 'Test search title',
    };
    const variants = [
      { sku: 'INTEGRATION-S', attributes: { Size: 'S' }, price: null, stock: 3, active: true },
    ];
    const saved = await asUser(
      admin,
      `select public.save_product(null,'${JSON.stringify(input)}','${JSON.stringify(variants)}') id`,
    );
    const id = (saved.rows[0] as { id: string }).id;
    const row = (
      await db.query<{ updated_at: string }>(
        'select updated_at::text from public.products where id=$1',
        [id],
      )
    ).rows[0];
    const variant = (
      await db.query<{ id: string }>('select id from public.product_variants where product_id=$1', [
        id,
      ])
    ).rows[0];
    const updated = [{ ...variants[0], id: variant.id, stock: 5, expectedStock: 3 }];
    await asUser(
      admin,
      `select public.save_product('${id}','${JSON.stringify(input)}','${JSON.stringify(updated)}','${row.updated_at}')`,
    );
    expect(
      (await db.query('select stock from public.product_variants where id=$1', [variant.id]))
        .rows[0],
    ).toEqual({ stock: 5 });
    await expect(
      asUser(
        admin,
        `select public.save_product('${id}','${JSON.stringify(input)}','${JSON.stringify(updated)}','${row.updated_at}')`,
      ),
    ).rejects.toThrow('changed');
  });
  it('rejects customer product creation', async () => {
    await expect(asUser(customer, `select public.save_product(null,'{}','[]')`)).rejects.toThrow(
      'Forbidden',
    );
  });
  it('does not publish an incomplete draft', async () => {
    const p = (
      await db.query<{ id: string; updated_at: string }>(
        'select *,updated_at::text as updated_at from public.products where slug=$1',
        ['integration-cotton-shirt'],
      )
    ).rows[0];
    await expect(
      asUser(
        admin,
        `select public.save_product('${p.id}','${JSON.stringify({ ...p, status: 'active' })}','[]','${p.updated_at}')`,
      ),
    ).rejects.toThrow('photograph');
    expect(
      (await db.query('select status from public.products where id=$1', [p.id])).rows[0],
    ).toEqual({ status: 'draft' });
  });
  it('allows extra photographs to be removed but preserves the last published photograph', async () => {
    const { rows } = await db.query<{ id: string }>(
      'select id from public.product_images where product_id=$1 order by position',
      ['20000000-0000-4000-8000-000000000003'],
    );
    for (const image of rows.slice(1)) {
      await asUser(
        admin,
        `select public.remove_product_image('20000000-0000-4000-8000-000000000003','${image.id}')`,
      );
    }
    await expect(
      asUser(
        admin,
        `select public.remove_product_image('20000000-0000-4000-8000-000000000003','${rows[0].id}')`,
      ),
    ).rejects.toThrow('last image');
  });
  it('moderates reviews and never verifies an unpaid test purchase', async () => {
    await asUser(
      customer,
      `select public.submit_review('20000000-0000-4000-8000-000000000001',4,'Synthetic review','Controlled testing content only')`,
    );
    expect((await db.query('select status,verified_purchase from public.reviews')).rows[0]).toEqual(
      { status: 'pending', verified_purchase: false },
    );
    await db.exec('set role anon');
    try {
      expect((await db.query('select * from public.published_reviews')).rows).toHaveLength(0);
    } finally {
      await db.exec('reset role');
    }
    await asUser(admin, "update public.reviews set status='published'");
    await db.exec('set role anon');
    try {
      const rows = (await db.query('select * from public.published_reviews')).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).not.toHaveProperty('user_id');
    } finally {
      await db.exec('reset role');
    }
  });
  it('prevents customers rewriting their identity email', async () => {
    await expect(
      asUser(customer, "update public.profiles set email='impersonation@example.test'"),
    ).rejects.toThrow('permission denied');
  });
  it('stores sign-up names on the new profile, unverified', async () => {
    const id = '50000000-0000-4000-8000-000000000010';
    await db.query(
      `insert into auth.users(id,email,raw_user_meta_data)values($1,'names@example.test',$2)`,
      [id, JSON.stringify({ first_name: 'Mary Jane', last_name: 'Bello' })],
    );
    expect(
      (
        await db.query(
          'select display_name,first_name,last_name,email_verified_at from public.profiles where id=$1',
          [id],
        )
      ).rows[0],
    ).toEqual({
      display_name: 'Mary Jane Bello',
      first_name: 'Mary Jane',
      last_name: 'Bello',
      email_verified_at: null,
    });
  });
  it('splits a provider full name when no separate names are given', async () => {
    const id = '50000000-0000-4000-8000-000000000011';
    await db.query(
      `insert into auth.users(id,email,raw_user_meta_data)values($1,'google@example.test',$2)`,
      [id, JSON.stringify({ full_name: 'Tolu Ade Bello' })],
    );
    expect(
      (await db.query('select first_name,last_name from public.profiles where id=$1', [id]))
        .rows[0],
    ).toEqual({ first_name: 'Tolu', last_name: 'Ade Bello' });
  });
  it('lets customers edit their names but never mark their own email verified', async () => {
    await asUser(customer, "update public.profiles set first_name='Ada',last_name='Obi'");
    await expect(
      asUser(customer, 'update public.profiles set email_verified_at=now()'),
    ).rejects.toThrow('permission denied');
  });
  it('lets only one of two writes conditioned on the same updated_at succeed', async () => {
    try {
      const inserted = await asUser(
        customer,
        `insert into public.shopping_state(user_id,updated_at)values('${customer}','2026-10-05T10:00:00.000Z') returning updated_at::text stamp`,
      );
      const stamp = (inserted.rows[0] as { stamp: string }).stamp;
      const write = (quantity: number, at: string) =>
        asUser(
          customer,
          `update public.shopping_state set lines='[{"variantId":"30000000-0000-4000-8000-000000000001","quantity":${quantity}}]',updated_at='${at}' where user_id='${customer}' and updated_at='${stamp}' returning user_id`,
        );
      expect((await write(1, '2026-10-05T10:00:01.000Z')).rows).toHaveLength(1);
      // The second device read the same updated_at, so its write matches nothing and it must retry.
      expect((await write(2, '2026-10-05T10:00:02.000Z')).rows).toHaveLength(0);
      const saved = await asUser(
        customer,
        `select lines from public.shopping_state where user_id='${customer}'`,
      );
      expect(saved.rows).toEqual([
        { lines: [{ variantId: '30000000-0000-4000-8000-000000000001', quantity: 1 }] },
      ]);
    } finally {
      await db.exec(`delete from public.shopping_state where user_id='${customer}'`);
    }
  });
  it('publishes shopping_state to Realtime once the publication exists', async () => {
    const sql = await readFile('supabase/migrations/202610050002_shopping_realtime.sql', 'utf8');
    await db.exec('create publication supabase_realtime');
    await db.exec(sql);
    await db.exec(sql);
    const tables = await db.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname='supabase_realtime'",
    );
    expect(tables.rows).toEqual([{ tablename: 'shopping_state' }]);
  });
});

describe('Order cancellation and restocking', () => {
  it('restores an unpaid order exactly once and prevents later fulfilment', async () => {
    const row = (await db.query<{ id: string }>('select id from public.orders limit 1')).rows[0];
    await asUser(
      admin,
      `select public.manage_order('${row.id}','cancel','Synthetic test cancellation')`,
    );
    expect(
      (
        await db.query(
          "select stock from public.product_variants where id='30000000-0000-4000-8000-000000000001'",
        )
      ).rows[0],
    ).toEqual({ stock: 7 });
    await expect(
      asUser(admin, `select public.manage_order('${row.id}','cancel','')`),
    ).rejects.toThrow('Invalid');
    await expect(
      asUser(admin, `select public.update_fulfilment('${row.id}','shipped','')`),
    ).rejects.toThrow('Cancelled');
  });
});

describe('Database input guards', () => {
  it('requires explicit test acknowledgement at the database boundary', async () => {
    await expect(
      db.query(
        `select public.create_test_order('[{"variantId":"30000000-0000-4000-8000-000000000001","quantity":1}]','{"email":"test@example.test","state":"Lagos"}',gen_random_uuid(),repeat('c',64),null)`,
      ),
    ).rejects.toThrow('Test acknowledgement');
  });
  it('rejects foreign product images in a reorder', async () => {
    const image = (
      await db.query<{ id: string }>(
        "select id from public.product_images where product_id='20000000-0000-4000-8000-000000000002' limit 1",
      )
    ).rows[0];
    await expect(
      asUser(
        admin,
        `select public.reorder_images('20000000-0000-4000-8000-000000000003',array['${image.id}']::uuid[])`,
      ),
    ).rejects.toThrow('Image list changed');
  });
});

describe('Variant photography', () => {
  const shirt = '20000000-0000-4000-8000-000000000002';
  const sage = '31000000-0000-4000-8000-000000000101';
  it('saves assigned photographs through the admin transaction', async () => {
    await db.exec('begin');
    try {
      const p = (
        await db.query<{ id: string; updated_at: string }>(
          'select *,updated_at::text as updated_at from public.products where id=$1',
          [shirt],
        )
      ).rows[0];
      const v = (
        await db.query<{ stock: number }>('select * from public.product_variants where id=$1', [
          sage,
        ])
      ).rows[0];
      const variants = [{ ...v, expectedStock: v.stock, image: '/images/shirt-dusty-blue.webp' }];
      await asUser(
        admin,
        `select public.save_product('${shirt}','${JSON.stringify(p)}','${JSON.stringify(variants)}','${p.updated_at}')`,
      );
      expect(
        (await db.query('select image from public.product_variants where id=$1', [sage])).rows[0],
      ).toEqual({ image: '/images/shirt-dusty-blue.webp' });
    } finally {
      await db.exec('rollback');
    }
  });
  it('rejects foreign photographs and rolls back the whole admin save', async () => {
    const p = (
      await db.query<{ updated_at: string }>(
        'select *,updated_at::text as updated_at from public.products where id=$1',
        [shirt],
      )
    ).rows[0];
    const v = (
      await db.query<{ stock: number }>('select * from public.product_variants where id=$1', [sage])
    ).rows[0];
    const variants = [{ ...v, expectedStock: v.stock, image: '/images/bag.jpg' }];
    await expect(
      asUser(
        admin,
        `select public.save_product('${shirt}','${JSON.stringify({ ...p, name: 'Must roll back' })}','${JSON.stringify(variants)}','${p.updated_at}')`,
      ),
    ).rejects.toThrow('variant_image_product');
    expect(
      (await db.query('select name from public.products where id=$1', [shirt])).rows[0],
    ).toEqual({ name: 'The everyday linen shirt' });
  });
  it('snapshots the chosen colour and retains it after the media is removed', async () => {
    await db.exec('begin');
    try {
      await db.query(
        `select public.create_test_order('[{"variantId":"${sage}","quantity":1}]','{"acceptTest":true,"state":"Lagos","email":"colours@example.test"}',gen_random_uuid(),repeat('d',64),null)`,
      );
      expect(
        (await db.query('select image from public.order_items where variant_id=$1', [sage]))
          .rows[0],
      ).toEqual({ image: '/images/shirt-sage.webp' });
      const media = (
        await db.query<{ id: string }>(
          'select id from public.product_images where product_id=$1 and url=$2',
          [shirt, '/images/shirt-sage.webp'],
        )
      ).rows[0];
      await asUser(admin, `select public.remove_product_image('${shirt}','${media.id}')`);
      expect(
        (await db.query('select image from public.product_variants where id=$1', [sage])).rows[0],
      ).toEqual({ image: null });
      expect(
        (await db.query('select image from public.order_items where variant_id=$1', [sage]))
          .rows[0],
      ).toEqual({ image: '/images/shirt-sage.webp' });
    } finally {
      await db.exec('rollback');
    }
  });
  it('reapplying fixtures retains adjusted stock and does not duplicate photographs', async () => {
    await db.exec('begin');
    try {
      await db.query('update public.product_variants set stock=2 where id=$1', [sage]);
      await db.exec(await readFile('supabase/seed.sql', 'utf8'));
      expect(
        (await db.query('select stock from public.product_variants where id=$1', [sage])).rows[0],
      ).toEqual({ stock: 2 });
      expect(
        (await db.query('select id from public.product_images where product_id=$1', [shirt])).rows,
      ).toHaveLength(3);
    } finally {
      await db.exec('rollback');
    }
  });
});

describe('Expanded catalogue pricing', () => {
  it('uses seeded variant price overrides in an authoritative order snapshot', async () => {
    await db.exec('begin');
    try {
      const product = products.find((p) => p.slug === 'daybreak-trousers')!;
      const variant = product.variants.find(
        (v) =>
          v.attributes.Colour === 'Olive' &&
          v.attributes.Size === 'M' &&
          v.attributes.Length === 'Long',
      )!;
      await db.query(
        `select public.create_test_order('[{"variantId":"${variant.id}","quantity":1}]','{"acceptTest":true,"state":"Lagos","email":"variants@example.test"}',gen_random_uuid(),repeat('e',64),null)`,
      );
      expect(
        (
          await db.query(
            'select price,image,attributes from public.order_items where variant_id=$1',
            [variant.id],
          )
        ).rows[0],
      ).toEqual({
        price: 3150000,
        image: '/images/daybreak-trousers-olive.webp',
        attributes: { Colour: 'Olive', Size: 'M', Length: 'Long' },
      });
    } finally {
      await db.exec('rollback');
    }
  });
});
