'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Menu,
  Search,
  UserRound,
  Heart,
  ShoppingBag,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useShopping } from '@/features/cart/provider';
import { Bag } from '@/features/cart/bag';
import type { Category, Product } from '@/features/catalogue/types';
const nav = [
  ['Women', '/women'],
  ['Men', '/men'],
  ['Kids', '/kids'],
  ['New in', '/new-in'],
  ['Shoes', '/shoes'],
  ['Accessories', '/accessories'],
];
export function Header({
  categories,
  products,
  announcement,
  featured,
}: {
  categories: Category[];
  products: Product[];
  announcement: string;
  featured: string;
}) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const { lines, bagOpen, setBagOpen } = useShopping();
  const suggestions =
    query.trim().length > 1
      ? products
          .filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 4)
      : [];
  return (
    <>
      <div className="announcement">
        <span>{announcement}</span>
        <Link href="/new-in">
          Find your next favourite <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="site-header">
        <div className="header-main container">
          <div className="header-start">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="brand-note">
              A considered wardrobe.
              <br />
              An everyday point of view.
            </span>
          </div>
          <Link href="/" className="wordmark" aria-label="The Oreva Edit home">
            <span>THE</span>OREVA EDIT<span className="wordmark-sub">WEAR IT YOUR WAY</span>
          </Link>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Search catalogue"
              onClick={() => setSearch(true)}
            >
              <Search />
            </button>
            <Link className="icon-button desktop-only" href="/account" aria-label="My account">
              <UserRound />
            </Link>
            <Link className="icon-button desktop-only" href="/wishlist" aria-label="My wishlist">
              <Heart />
            </Link>
            <button
              className="icon-button bag-trigger"
              aria-label={`Open shopping bag, ${lines.reduce((n, l) => n + l.quantity, 0)} items`}
              onClick={() => setBagOpen(true)}
            >
              <ShoppingBag />
              <span>{lines.reduce((n, l) => n + l.quantity, 0)}</span>
            </button>
          </div>
        </div>
        <nav aria-label="Main navigation" className="desktop-nav">
          <Link href="/shop">Shop all</Link>
          {nav.map(([name, href]) => (
            <Link key={href} href={href}>
              {name}
            </Link>
          ))}
          <Link className="nav-editorial" href={`/collections/${featured}`}>
            The Featured Edit <ArrowUpRight size={13} />
          </Link>
        </nav>
      </header>
      <Dialog open={menu} onClose={() => setMenu(false)} title="Explore the edit" side>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <Link href="/shop" onClick={() => setMenu(false)}>
            Shop all <ArrowUpRight />
          </Link>
          {nav.map(([name, href]) => (
            <details key={href}>
              <summary>
                {name}
                <ChevronRight size={18} />
              </summary>
              <Link href={href} onClick={() => setMenu(false)}>
                Shop all {name.toLowerCase()}
              </Link>
              {categories.slice(0, 6).map((c) => (
                <Link key={c.id} href={`${href}?category=${c.slug}`} onClick={() => setMenu(false)}>
                  {c.name}
                </Link>
              ))}
            </details>
          ))}
          <Link href="/account" onClick={() => setMenu(false)}>
            My account
          </Link>
          <Link href="/wishlist" onClick={() => setMenu(false)}>
            Wishlist
          </Link>
        </nav>
      </Dialog>
      <Dialog open={search} onClose={() => setSearch(false)} title="Find something you love">
        <form action="/search" onSubmit={() => setSearch(false)} className="search-form">
          <label className="sr-only" htmlFor="header-search">
            Search products
          </label>
          <input
            id="header-search"
            name="q"
            autoComplete="off"
            placeholder="Try a linen shirt, dress or earrings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-button" aria-label="Submit search">
            <Search />
          </button>
        </form>
        <p className="eyebrow search-label">
          {query.length > 1 ? 'Matching pieces' : 'A good place to start'}
        </p>
        <div className="search-suggestions">
          {query.length > 1 ? (
            suggestions.length ? (
              suggestions.map((p) => (
                <Link key={p.id} onClick={() => setSearch(false)} href={`/products/${p.slug}`}>
                  {p.name}
                  <ArrowUpRight size={16} />
                </Link>
              ))
            ) : (
              <p>No matching pieces yet. Try another word.</p>
            )
          ) : (
            ['Dresses', 'Shirts', 'Jewellery', 'Bags'].map((c) => (
              <Link key={c} onClick={() => setSearch(false)} href={`/search?q=${c}`}>
                {c}
                <ArrowUpRight size={16} />
              </Link>
            ))
          )}
        </div>
      </Dialog>
      <Dialog open={bagOpen} onClose={() => setBagOpen(false)} title="Your shopping bag" side>
        <Bag products={products} compact onNavigate={() => setBagOpen(false)} />
      </Dialog>
    </>
  );
}
