import { makeProduct, type FixtureStyle } from './fixture-builder.ts';

const styles: FixtureStyle[] = [
  {
    number: 25,
    name: 'The open-layer shirt',
    slug: 'open-layer-shirt',
    category: 'Shirts',
    audience: 'men',
    price: 26500,
    summary: 'A warm colour. An easy extra layer.',
    description:
      'A long-sleeved button-through shirt in mustard. Wear it open over a white tee or buttoned with your favourite trousers.',
    colours: [{ name: 'Mustard', image: '/images/open-layer-shirt.webp' }],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    details: ['Button-through front', 'Long sleeves', 'Relaxed silhouette'],
  },
  {
    number: 26,
    name: 'The textured straight trousers',
    slug: 'textured-straight-trousers',
    category: 'Trousers',
    audience: 'men',
    price: 34500,
    summary: 'A straight leg with a little texture.',
    description:
      'Grey patterned trousers with a neat waistband and a straight leg. Choose your waist size and inside-leg length for a fit that works with your everyday rotation.',
    colours: [{ name: 'Grey', image: '/images/textured-trousers.webp' }],
    options: [
      { name: 'Size', values: ['28 in', '30 in', '32 in', '34 in', '36 in', '38 in'] },
      { name: 'Length', values: ['30 in', '32 in', { label: '34 in', extra: 2000 }] },
    ],
    details: [
      'Grey textured pattern',
      'Straight leg',
      'Size is waist circumference; length is inside leg, both in inches',
    ],
    unavailable: [{ Size: '38 in', Length: '34 in' }],
  },
  {
    number: 27,
    name: 'The everyday baseball cap',
    slug: 'everyday-baseball-cap',
    category: 'Caps',
    audience: 'men',
    price: 12500,
    summary: 'A curved peak. A clean finish.',
    description:
      'A simple baseball cap with a curved peak and an understated shape. Choose white, ink or olive to finish your everyday outfit.',
    colours: [
      { name: 'White', image: '/images/everyday-cap.webp' },
      { name: 'Ink', image: '/images/everyday-cap-ink.webp' },
      { name: 'Olive', image: '/images/everyday-cap-olive.webp' },
    ],
    options: [{ name: 'Size', values: ['One size'] }],
    details: ['Curved peak', 'Panelled crown', 'Plain front'],
  },
  {
    number: 28,
    name: 'The square-frame sunglasses',
    slug: 'square-frame-sunglasses',
    category: 'Sunglasses',
    audience: 'men',
    price: 18500,
    summary: 'Bold frames. A familiar shape.',
    description:
      'Black square frames with dark lenses and a substantial profile. A finishing touch for a simple tee, an open shirt or your weekend jacket.',
    colours: [{ name: 'Black', image: '/images/square-sunglasses.webp' }],
    options: [{ name: 'Size', values: ['One size'] }],
    details: ['Square frame', 'Dark lenses', 'Black finish'],
  },
  {
    number: 29,
    name: 'The everyday boxer briefs',
    slug: 'everyday-boxer-briefs',
    category: 'Boxers',
    audience: 'men',
    price: 8500,
    summary: 'Everyday basics, down to the first layer.',
    description:
      'Close-fitting boxer briefs with a broad waistband and short leg. Choose your size and a single pair or a three-pack in the same colour.',
    colours: [{ name: 'Blue', image: '/images/everyday-boxers.webp' }],
    options: [
      { name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] },
      { name: 'Pack', values: ['Single pair', { label: '3 pairs', extra: 15000 }] },
    ],
    details: [
      'Short-leg boxer brief',
      'Broad waistband',
      'Three-pack contains three pairs in the selected colour and size',
    ],
    unavailable: [{ Size: 'XXL', Pack: '3 pairs' }],
  },
  {
    number: 30,
    name: 'The everyday singlet',
    slug: 'everyday-singlet',
    category: 'Singlets',
    audience: 'men',
    price: 11500,
    summary: 'A simple first layer, or the only one you need.',
    description:
      'A sleeveless singlet with a scoop neck and a straightforward shape. Wear it under a shirt or on its own with shorts on warmer days.',
    colours: [
      { name: 'Lime', image: '/images/everyday-singlet.webp' },
      { name: 'Ink', image: '/images/everyday-singlet-ink.webp' },
    ],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    details: ['Scoop neck', 'Sleeveless shape', 'Easy to layer'],
  },
  {
    number: 31,
    name: 'The washed denim shorts',
    slug: 'washed-denim-shorts',
    category: 'Shorts',
    audience: 'men',
    price: 24500,
    summary: 'A washed finish with a brighter point of view.',
    description:
      'Green washed denim shorts with a relaxed shape and turned hems. Pair with a plain tee and let the colour do the talking.',
    colours: [{ name: 'Washed green', image: '/images/washed-denim-shorts.webp' }],
    options: [{ name: 'Size', values: ['28 in', '30 in', '32 in', '34 in', '36 in', '38 in'] }],
    details: ['Washed green finish', 'Turned hems', 'Size labels are waist measurements in inches'],
  },
  {
    number: 32,
    name: 'The city varsity jacket',
    slug: 'city-varsity-jacket',
    category: 'Jackets',
    audience: 'men',
    price: 48500,
    summary: 'An extra layer for the way home.',
    description:
      'A beige varsity-style jacket with dark sleeve stripes and ribbed edges. Wear over a tee or singlet when the evening calls for another layer.',
    colours: [{ name: 'Beige', image: '/images/city-varsity-jacket.webp' }],
    options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] }],
    details: ['Varsity silhouette', 'Striped sleeves', 'Ribbed cuffs and hem'],
  },
];

export const menswearProducts = styles.map(makeProduct);
