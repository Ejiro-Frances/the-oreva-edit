// Licensed development imagery. Attribution and source pages: docs/IMAGE_SOURCES.md.
import sharp from 'sharp';
const images = [
  ['everyday-tank', 7229123],
  ['daybreak-trousers', 17135748],
  ['clean-cut-tee', 26954027],
  ['studio-heels', 27565822, 'png'],
  ['fine-line-necklace', 12194264],
  ['sunroom-frames', 10388460],
  ['little-occasion-dress', 7139052],
  ['junior-everyday-tee', 25849085],
  ['daylight-skirt', 39457814],
  ['weekend-shorts', 11030839, 'png'],
  ['woven-bracelet', 12194339],
  ['woven-sun-hat', 4394270],
];
const requested = new Set(process.argv.slice(2));
for (const [name, id, extension = 'jpeg'] of images) {
  if (requested.size && !requested.has(name)) continue;
  const response = await fetch(
    `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${extension}?auto=compress&cs=tinysrgb&w=1200`,
  );
  if (!response.ok) throw new Error(`Image ${id}: ${response.status}`);
  await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .resize({ width: 1000, height: 1500, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(`public/images/${name}.webp`);
  console.log(`Saved ${name}`);
}
