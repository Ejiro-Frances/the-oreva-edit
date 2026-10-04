import type { Product } from './types';

type OptionValue = string | { label: string; extra: number };
export type FixtureStyle = {
  number: number;
  name: string;
  slug: string;
  category: string;
  audience: string;
  price: number;
  summary: string;
  description: string;
  colours: { name: string; image: string }[];
  options: { name: string; values: OptionValue[] }[];
  details: string[];
  unavailable?: Record<string, string>[];
};

export function makeProduct(style: FixtureStyle): Product {
  let combinations: { attributes: Record<string, string>; extra: number }[] = [
    { attributes: {}, extra: 0 },
  ];
  for (const option of style.options) {
    combinations = combinations.flatMap((combination) =>
      option.values.map((value) => ({
        attributes: {
          ...combination.attributes,
          [option.name]: typeof value === 'string' ? value : value.label,
        },
        extra: combination.extra + (typeof value === 'string' ? 0 : value.extra),
      })),
    );
  }
  return {
    id: `20000000-0000-4000-8000-${String(style.number).padStart(12, '0')}`,
    name: style.name,
    slug: style.slug,
    category: style.category,
    audience: style.audience,
    price: style.price * 100,
    compare_at: null,
    short_description: style.summary,
    description: style.description,
    images: style.colours.map((colour) => colour.image),
    alt: `${style.name} in ${style.colours[0].name}; product photograph`,
    status: 'active',
    fixture: true,
    featured: false,
    tags: ['new-in', 'everyday', 'the-everyday-edit'],
    created_at: '2026-10-03T00:00:00Z',
    details: style.details,
    care: 'Follow the product care label.',
    variants: style.colours.flatMap((colour, colourIndex) =>
      combinations.map((combination, index) => {
        const attributes: Record<string, string> = {
          Colour: colour.name,
          ...combination.attributes,
        };
        const soldOut = style.unavailable?.some((match) =>
          Object.entries(match).every(([key, value]) => attributes[key] === value),
        );
        return {
          id: `32000000-0000-4000-8000-${String(style.number * 1000 + colourIndex * 100 + index + 1).padStart(12, '0')}`,
          sku: `DEV-ORE-${style.number}-${colourIndex + 1}-${index + 1}`,
          attributes,
          price: combination.extra ? (style.price + combination.extra) * 100 : null,
          stock: soldOut ? 0 : 4 + (index % 5),
          image: colour.image,
        };
      }),
    ),
  };
}
