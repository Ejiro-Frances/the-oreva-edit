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
  ['open-layer-shirt', 7562181],
  ['textured-trousers', 16154368],
  ['everyday-cap', 9775723],
  ['square-sunglasses', 28843753],
  ['everyday-boxers', 8874670, 'jpeg', { left: 0.57, top: 0.02, width: 0.42, height: 0.98 }],
  ['everyday-singlet', 8554983],
  ['washed-denim-shorts', 11972576],
  ['city-varsity-jacket', 7385437],
];
const requested = new Set(process.argv.slice(2));
for (const [name, id, extension = 'jpeg', crop] of images) {
  if (requested.size && !requested.has(name)) continue;
  const response = await fetch(
    `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${extension}?auto=compress&cs=tinysrgb&w=1200`,
  );
  if (!response.ok) throw new Error(`Image ${id}: ${response.status}`);
  const input = await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .toBuffer();
  const photo = sharp(input);
  if (crop) {
    const { width, height } = await photo.metadata();
    photo.extract({
      left: Math.floor(width * crop.left),
      top: Math.floor(height * crop.top),
      width: Math.floor(width * crop.width),
      height: Math.floor(height * crop.height),
    });
  }
  await photo
    .resize({ width: 1000, height: 1500, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(`public/images/${name}.webp`);
  console.log(`Saved ${name}`);
}
