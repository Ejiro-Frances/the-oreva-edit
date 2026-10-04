import type { Category, Product } from './types';

export const productCategorySlug = (product: Product) =>
  product.category_slug || product.category.toLowerCase().replaceAll(' ', '-');

export function categoryBranchSlugs(categories: Category[], roots: string[]) {
  const slugs = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      const parent = categories.find((candidate) => candidate.id === category.parent_id);
      if (category.active && parent && slugs.has(parent.slug) && !slugs.has(category.slug)) {
        slugs.add(category.slug);
        changed = true;
      }
    }
  }
  return slugs;
}

export function categoriesForProducts(categories: Category[], products: Product[]) {
  const slugs = new Set(products.filter((p) => p.status === 'active').map(productCategorySlug));
  const ids = new Set(categories.filter((c) => slugs.has(c.slug)).map((c) => c.id));
  // Keep populated parent categories selectable, including deeper admin-created branches.
  for (const id of ids) {
    const parent = categories.find((c) => c.id === id)?.parent_id;
    if (parent) ids.add(parent);
  }
  return categories.filter((category) => category.active && ids.has(category.id));
}

export function navigationProducts(products: Product[], categories: Category[], section: string) {
  const active = products.filter((p) => p.status === 'active');
  if (['women', 'men'].includes(section)) return active.filter((p) => p.audience === section);
  if (section === 'kids')
    return active.filter((p) => ['girls', 'boys', 'babies'].includes(p.audience));
  if (section === 'accessories' || section === 'shoes') {
    const roots = section === 'accessories' ? ['accessories', 'bags', 'jewellery'] : ['shoes'];
    const slugs = categoryBranchSlugs(categories, roots);
    return active.filter((p) => slugs.has(productCategorySlug(p)));
  }
  return active;
}
