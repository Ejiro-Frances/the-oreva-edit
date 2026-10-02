import { writeFile } from 'node:fs/promises';
const agent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
for (const [name, family] of [
  ['display', 'Cormorant+Garamond:wght@400..700'],
  ['display-italic', 'Cormorant+Garamond:ital,wght@1,400..700'],
  ['body', 'Manrope:wght@400..800'],
]) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, {
      headers: { 'User-Agent': agent },
    })
  ).text();
  const url = [...css.matchAll(/url\((https:[^)]+)\)/g)].at(-1)?.[1];
  if (!url) throw new Error('Font URL missing');
  await writeFile(
    `public/fonts/${name}.woff2`,
    Buffer.from(await (await fetch(url)).arrayBuffer()),
  );
  console.log('Downloaded variable font: ' + name);
}
