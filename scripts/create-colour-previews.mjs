// Development-only colour studies of the licensed photographs in docs/IMAGE_SOURCES.md.
// These edits are not accurate product photography and must not be used for real sales.
import sharp from 'sharp';

const studies = [
  {
    source: 'shirt',
    width: 600,
    height: 900,
    outline:
      '12,900 14,830 18,802 17,774 28,755 34,707 43,660 55,594 62,557 82,530 101,503 122,477 141,462 169,449 217,431 267,412 281,434 306,448 330,452 347,456 372,449 399,436 413,419 420,429 447,441 498,463 525,479 539,487 551,503 563,529 581,558 595,605 600,619 600,900',
    colours: { sage: [112, 130, 112], 'dusty-blue': [90, 118, 140] },
  },
  {
    source: 'bag',
    width: 600,
    height: 600,
    outline:
      '204,251 276,248 439,246 548,247 553,251 552,273 543,318 537,376 532,419 530,469 533,514 535,531 532,541 524,546 407,543 380,536 343,528 306,525 299,510 274,498 250,495 249,479 243,462 229,458 214,459 213,395 208,330 204,282',
    colours: { cocoa: [125, 88, 67], oxblood: [107, 49, 65] },
  },
  {
    source: 'everyday-tank',
    extension: 'webp',
    width: 600,
    height: 900,
    outline:
      '183,681 194,641 207,600 231,556 247,550 250,567 260,588 282,608 307,620 332,625 353,620 367,612 375,600 378,581 380,544 399,538 414,565 434,608 450,647 460,670 459,716 449,755 438,795 433,848 430,898 383,896 322,892 260,881 207,862 184,842 188,820 199,792 196,741',
    colours: { sage: [119, 139, 118], rose: [167, 114, 117] },
  },
  {
    source: 'daylight-skirt',
    extension: 'webp',
    width: 600,
    height: 900,
    outline:
      '182,15 220,26 269,32 317,28 369,14 378,42 384,58 382,75 384,95 395,116 401,143 402,177 408,215 407,245 412,285 411,299 374,301 324,305 278,310 223,311 178,307 157,298 155,272 153,237 153,197 155,162 160,131 170,142 180,150 188,146 181,135 175,122 193,134 214,146 222,141 215,134 193,119 199,119 218,127 232,131 236,126 221,116 196,102 185,89 186,84 204,91 217,92 221,86 213,80 197,68 195,63 200,62 208,71 218,74 223,69 218,63 203,51 185,40',
    colours: { stone: [176, 161, 143], oxblood: [112, 53, 68] },
  },
  {
    source: 'weekend-shorts',
    extension: 'webp',
    width: 506,
    height: 900,
    outline:
      '146,253 185,255 230,265 281,269 319,272 357,269 391,262 414,255 431,253 446,269 454,291 456,316 450,340 448,364 446,387 446,416 443,441 449,468 447,501 445,535 446,571 445,609 444,643 441,665 420,672 386,675 344,678 299,677 296,654 294,615 287,580 281,550 276,529 271,535 260,567 248,602 239,637 230,670 229,687 218,699 197,707 172,711 143,708 119,704 93,695 75,691 78,673 80,653 80,624 83,592 84,562 80,537 80,513 75,483 80,457 82,430 80,406 78,380 78,356 79,330 81,300 93,315 107,331 118,347 123,338 133,309 141,284',
    colours: { olive: [111, 119, 90], navy: [54, 75, 97] },
  },
  {
    source: 'daybreak-trousers',
    extension: 'webp',
    width: 600,
    height: 900,
    outline:
      '222,48 295,55 363,51 424,42 439,79 458,118 468,169 464,192 459,209 461,243 465,262 470,269 473,281 468,338 463,412 459,486 457,539 457,637 463,682 444,692 414,692 380,683 382,629 381,573 378,528 367,476 359,433 356,391 346,350 339,308 336,277 325,300 309,356 293,406 282,457 269,510 260,561 253,616 252,689 225,696 184,698 134,688 136,659 154,574 171,494 182,431 186,387 187,345 191,284 203,283 217,278 217,265 211,248 217,245 217,225 204,188 204,154 203,119 207,87',
    colours: { olive: [110, 117, 87], ink: [60, 64, 68] },
  },
];
const requested = new Set(process.argv.slice(2));
for (const study of studies) {
  if (requested.size && !requested.has(study.source)) continue;
  const { data, info } = await sharp(`public/images/${study.source}.${study.extension || 'jpg'}`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const svg = `<svg width="${info.width}" height="${info.height}" viewBox="0 0 ${study.width} ${study.height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${study.outline}" fill="white"/></svg>`;
  const mask = await sharp(Buffer.from(svg)).blur(0.6).ensureAlpha().raw().toBuffer();
  for (const [name, rgb] of Object.entries(study.colours)) {
    const output = Buffer.from(data);
    for (let pixel = 0; pixel < info.width * info.height; pixel++) {
      const offset = pixel * 3;
      const [r, g, b] = data.subarray(offset, offset + 3);
      // Keep the bag's brown leather trim; recolour only the neutral woven body.
      const neutral =
        study.source === 'bag'
          ? Math.max(0, Math.min(1, (55 - (Math.max(r, g, b) - Math.min(r, g, b))) / 20))
          : 1;
      const alpha = (mask[pixel * 4 + 3] / 255) * neutral;
      const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 210;
      for (let channel = 0; channel < 3; channel++) {
        output[offset + channel] = Math.round(
          data[offset + channel] * (1 - alpha) + Math.min(255, rgb[channel] * luminance) * alpha,
        );
      }
    }
    await sharp(output, { raw: info })
      .webp({ quality: 85 })
      .toFile(`public/images/${study.source}-${name}.webp`);
  }
}
for (const [source, extension] of [
  ['fine-line-necklace', 'webp'],
  ['woven-bracelet', 'webp'],
  ['earrings', 'jpg'],
]) {
  if (requested.size && !requested.has(source)) continue;
  await sharp(`public/images/${source}.${extension}`)
    .grayscale()
    .webp({ quality: 85 })
    .toFile(`public/images/${source}-silver.webp`);
}
