import { getSiteSettings } from '@/features/catalogue/site-settings';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, PackageCheck, HeartHandshake, Truck } from 'lucide-react';
import { getProducts } from '@/features/catalogue/repository';
import { ProductCard } from '@/features/catalogue/product-card';
export default async function Home() {
  const [products, settings] = await Promise.all([getProducts(), getSiteSettings()]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">THE EVERYDAY EDIT / VOL. 01</span>
          <h1>
            Good pieces.
            <br />
            Real life.
            <br />
            <em>All you.</em>
          </h1>
          <p>
            For the plans you make.
            <br />
            And the days that make themselves.
          </p>
          <Link className="button" href="/new-in">
            Meet your new favourites <ArrowUpRight size={17} />
          </Link>
          <span className="hero-footnote">A fresh perspective on everyday dressing.</span>
        </div>
        <div className="hero-image">
          <Image
            src="/images/campaign.jpg"
            alt="A model in a black strapless top and relaxed trousers, with arms raised against a warm studio backdrop"
            fill
            preload
            sizes="(max-width: 700px) 100vw, 55vw"
          />
          <span className="image-caption">THE ART OF BEING YOURSELF.</span>
          <div className="hero-image-index">
            <span>01 — THE EVERYDAY EDIT</span>
            <ArrowUpRight size={20} />
          </div>
        </div>
        <span className="hero-vertical">THE OREVA POINT OF VIEW</span>
      </section>
      <div className="editorial-strip">
        <span>Considered style.</span>
        <span className="strip-dot" />
        <span>Every day. Every version of you.</span>
        <span className="strip-dot" />
        <Link href="/about">
          This is The Oreva Edit <ArrowUpRight size={13} />
        </Link>
      </div>
      <section className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">JUST LANDED</span>
            <h2>Fresh into the edit.</h2>
          </div>
          <Link className="text-link" href="/new-in">
            Shop new in <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="product-grid home-grid">
          {[...products.filter((p) => p.featured), ...products.filter((p) => !p.featured)]
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section className="section container category-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR POINT OF VIEW</span>
            <h2>A wardrobe for every chapter.</h2>
          </div>
          <p>Yours. Theirs. The little ones’.</p>
        </div>
        <div className="category-grid">
          {[
            { name: 'Women', image: 'dress', text: 'For all the ways you show up.' },
            { name: 'Men', image: 'shirt', text: 'The pieces you’ll live in.' },
            { name: 'Kids', image: 'kids', text: 'Little people. Big personalities.' },
          ].map((c) => (
            <Link className="category-card" href={`/${c.name.toLowerCase()}`} key={c.name}>
              <div className="category-image">
                <Image
                  src={`/images/${c.image}.jpg`}
                  alt={`${c.name} fashion development editorial`}
                  fill
                  sizes="(max-width: 600px) 90vw, 33vw"
                />
              </div>
              <div className="category-caption">
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.text}</p>
                </div>
                <ArrowUpRight size={24} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="story-feature">
        <div className="story-image">
          <Image
            src="/images/studio.jpg"
            alt="A model wearing a sculptural pleated dress in a warm neutral tone"
            fill
            sizes="(max-width: 700px) 100vw, 50vw"
          />
        </div>
        <div className="story-copy">
          <span className="eyebrow">LESS OVERTHINKING. MORE YOU.</span>
          <h2>
            The everyday,
            <br />
            <em>beautifully done.</em>
          </h2>
          <p>
            A great wardrobe doesn’t need to be complicated. Just a few good pieces that feel right,
            work together, and leave a little room for you.
          </p>
          <Link className="text-link" href={`/collections/${settings.featured}`}>
            Explore the featured edit <ArrowUpRight size={17} />
          </Link>
          <span className="story-number">EDIT No. 01</span>
        </div>
      </section>
      <section className="section container finishing-section">
        <div className="finishing-copy">
          <span className="eyebrow">THE FINAL WORD</span>
          <h2>
            Small details.
            <br />
            <em>All the difference.</em>
          </h2>
          <p>
            The bag that goes everywhere.
            <br />
            The earrings that finish the story.
          </p>
          <Link className="text-link" href="/accessories">
            Find your finishing touch <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="finishing-products">
          {products
            .filter((p) => ['Bags', 'Jewellery'].includes(p.category))
            .slice(0, 2)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section className="brand-statement">
        <span className="eyebrow">A NOTE FROM THE OREVA EDIT</span>
        <h2>
          Style is personal.
          <br />
          The edit is just the beginning.
        </h2>
        <Link className="text-link" href="/about">
          Get to know us <ArrowRight size={16} />
        </Link>
      </section>
      <div className="service-strip container">
        <div>
          <Truck />
          <span>
            Across Nigeria<small>Explore our delivery information</small>
          </span>
          <Link href="/delivery" aria-label="Read delivery information">
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div>
          <PackageCheck />
          <span>
            Know your options<small>Clear delivery and returns information</small>
          </span>
          <Link href="/returns" aria-label="Read returns information">
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div>
          <HeartHandshake />
          <span>
            A human touch<small>We’re here to help you choose</small>
          </span>
          <Link href="/contact" aria-label="Get in touch">
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </>
  );
}
