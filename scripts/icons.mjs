import sharp from 'sharp';
const svg = new URL('../public/icon.svg', import.meta.url);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(svg.pathname.replace(/^\/(\w:)/, '$1')).resize(size, size).png().toFile(new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
  console.log('ok', name);
}
