import { writeFile } from 'node:fs/promises';
import { products, categories, deliveryZones } from '../features/catalogue/fixtures.ts';
const sql = (v: unknown): string =>
  v === null
    ? 'null'
    : typeof v === 'boolean'
      ? String(v)
      : typeof v === 'number'
        ? String(v)
        : "'" + String(v).replaceAll("'", "''") + "'";
const json = (v: unknown) => sql(JSON.stringify(v)) + '::jsonb';
let out =
  '-- DEVELOPMENT FIXTURES ONLY. Never seed these products or delivery rates in production.\n';
for (const c of categories)
  out += `insert into public.categories(id,name,slug,position) values(${sql(c.id)},${sql(c.name)},${sql(c.slug)},${c.position}) on conflict(id) do nothing;\n`;
for (const p of products) {
  const c = categories.find((c) => c.name === p.category)!;
  out += `insert into public.products(id,name,slug,description,short_description,category_id,audience,price,status,fixture,featured,tags,details,care) values(${[p.id, p.name, p.slug, p.description, p.short_description, c.id, p.audience, p.price, p.status, true, p.featured].map(sql).join(',')},array[${p.tags.map(sql).join(',')}],array[${p.details.map(sql).join(',')}],${sql(p.care)}) on conflict(id) do nothing;\n`;
  out += `insert into public.product_images(product_id,path,url,alt,position) select ${sql(p.id)},${sql(p.images[0])},${sql(p.images[0])},${sql(p.alt)},0 where not exists(select 1 from public.product_images where product_id=${sql(p.id)});\n`;
  for (const v of p.variants)
    out += `insert into public.product_variants(id,product_id,sku,attributes,price,stock)values(${sql(v.id)},${sql(p.id)},${sql(v.sku)},${json(v.attributes)},null,${v.stock}) on conflict(id) do nothing;\n`;
}
for (const z of deliveryZones)
  out += `insert into public.delivery_zones(id,name,states,rate,min_days,max_days,active,fixture) values(${sql(z.id)},${sql(z.name)},array[${z.states.map(sql).join(',')}],${z.rate},${z.min_days},${z.max_days},true,true) on conflict(id) do nothing;\n`;
out +=
  "insert into public.collections(name,slug,description)values('The everyday edit','the-everyday-edit','A few good pieces. Endless ways to make them yours.') on conflict(slug) do nothing;\n";
await writeFile('supabase/seed.sql', out);
console.log('Development seed generated');
