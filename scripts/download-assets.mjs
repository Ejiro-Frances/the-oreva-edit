import { mkdir, writeFile } from 'node:fs/promises';

const assets = {
  campaign: [
    29853200,
    'Ifeyinka Adeyemo',
    'confident-black-woman-in-stylish-black-outfit',
    'Campaign and womenswear editorial',
  ],
  dress: [13816068, 'rehman yousaf', 'a-woman-wearing-a-beige-dress', 'Development dress'],
  studio: [
    8484082,
    'Sasha Kim',
    'a-woman-wearing-a-beige-dress',
    'Development collection editorial',
  ],
  shirt: [19189082, 'Çaba', 'man-in-gray-linen-shirt', 'Development menswear'],
  bag: [27127406, 'José Martin Segura Benites', 'leather-bag-and-belt', 'Development bag'],
  earrings: [7419523, 'Melike B', 'close-up-shot-of-gold-earrings', 'Development jewellery'],
  sandals: [
    8635546,
    'Source photographer credited on Pexels',
    'close-up-shot-of-beige-flat-sandals',
    'Development footwear',
  ],
  kids: [
    5693005,
    'Source photographer credited on Pexels',
    'adorable-ethnic-child-sorting-clothes-in-room',
    'Children editorial',
  ],
  baby: [
    7484842,
    'Source photographer credited on Pexels',
    'a-person-holding-baby-clothes',
    'Development toddler clothing',
  ],
};
await mkdir('public/images', { recursive: true });
await mkdir('public/fonts', { recursive: true });
for (const [name, [id]] of Object.entries(assets)) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${name === 'campaign' ? 1600 : 1000}&q=85`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  await writeFile(`public/images/${name}.jpg`, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${name}`);
}
await import('./download-fonts.mjs');
for (const family of ['cormorantgaramond', 'manrope']) {
  const response = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
  );
  if (!response.ok) throw new Error('Font licence missing');
  await writeFile(`public/fonts/${family}-OFL.txt`, await response.text());
}
await writeFile(
  'docs/IMAGE_SOURCES.md',
  `# Development image register\n\nAll photographs are temporary Pexels development imagery, downloaded 2 October 2026 under the [Pexels licence](https://www.pexels.com/license/). They do not depict actual Oreva inventory or imply model endorsement. Production product photography must be supplied by The Oreva Edit and accurately represent the item sold. Do not sell these photographs as standalone content.\n\n| Local image | Photographer | Original source | Intended use |\n|---|---|---|---|\n${Object.entries(
    assets,
  )
    .map(
      ([name, [id, creator, slug, use]]) =>
        `| /images/${name}.jpg | ${creator} | [Pexels ${id}](https://www.pexels.com/photo/${slug}-${id}/) | ${use} |`,
    )
    .join(
      '\n',
    )}\n\nFonts: Cormorant Garamond and Manrope, SIL Open Font License; licence copies are in public/fonts. Self-hosted with next/font/local.\n`,
);
