import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div className="footer-brand">
          <Link href="/" className="footer-wordmark">
            THE OREVA EDIT
          </Link>
          <p>
            Good pieces. Real life.
            <br />
            Your own point of view.
          </p>
          <span className="eyebrow">Based in Nigeria. Made for your everyday.</span>
        </div>
        <div>
          <h2>The wardrobe</h2>
          <Link href="/women">Women</Link>
          <Link href="/men">Men</Link>
          <Link href="/kids">Kids</Link>
          <Link href="/new-in">New in</Link>
          <Link href="/accessories">Accessories</Link>
        </div>
        <div>
          <h2>Here to help</h2>
          <Link href="/contact">
            Contact us <ArrowUpRight size={12} />
          </Link>
          <Link href="/delivery">Delivery information</Link>
          <Link href="/returns">Returns & refunds</Link>
          <Link href="/track-order">Track your order</Link>
          <Link href="/faq">Frequently asked questions</Link>
        </div>
        <div>
          <h2>A little about us</h2>
          <Link href="/about">Our point of view</Link>
          <Link href="/account">Your account</Link>
          <Link href="/wishlist">Your wishlist</Link>
          <p className="caption footer-small">
            The next chapter is taking shape.
            <br />
            New pieces, thoughtful choices.
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} The Oreva Edit</span>
        <div>
          <Link href="/privacy">Privacy & cookies</Link>
          <Link href="/terms">Terms & conditions</Link>
          <span>Nigeria · NGN ₦</span>
        </div>
      </div>
    </footer>
  );
}
