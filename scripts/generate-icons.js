import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#09090b" rx="110"/>
  <!-- Tactical grid subtle circles -->
  <circle cx="256" cy="256" r="180" fill="none" stroke="#27272a" stroke-width="2" stroke-dasharray="6,6"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#27272a" stroke-width="1.5"/>
  <circle cx="256" cy="256" r="95" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity="0.9"/>
  
  <!-- Crosshairs -->
  <line x1="256" y1="120" x2="256" y2="145" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="256" y1="367" x2="256" y2="392" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="120" y1="256" x2="145" y2="256" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <line x1="367" y1="256" x2="392" y2="256" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>

  <!-- Tactical tick corner accents -->
  <path d="M 176 176 L 196 176 M 176 176 L 176 196" fill="none" stroke="#71717a" stroke-width="3"/>
  <path d="M 336 176 L 316 176 M 336 176 L 336 196" fill="none" stroke="#71717a" stroke-width="3"/>
  <path d="M 176 336 L 196 336 M 176 336 L 176 316" fill="none" stroke="#71717a" stroke-width="3"/>
  <path d="M 336 336 L 316 336 M 336 336 L 336 316" fill="none" stroke="#71717a" stroke-width="3"/>

  <!-- Center Text -->
  <text x="256" y="246" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="64" fill="#ffffff" letter-spacing="2">CS2</text>
  <text x="256" y="284" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="20" fill="#a1a1aa" letter-spacing="6">FREITAG</text>
  
  <!-- Mini orange tactical pip -->
  <circle cx="256" cy="308" r="4" fill="#f97316"/>
</svg>`;

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#09090b"/>
  <!-- Tactical grid subtle circles in safe zone -->
  <circle cx="256" cy="256" r="160" fill="none" stroke="#27272a" stroke-width="2" stroke-dasharray="6,6"/>
  <circle cx="256" cy="256" r="115" fill="none" stroke="#27272a" stroke-width="1.5"/>
  <circle cx="256" cy="256" r="80" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity="0.9"/>
  
  <!-- Crosshairs -->
  <line x1="256" y1="145" x2="256" y2="165" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="256" y1="347" x2="256" y2="367" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="145" y1="256" x2="165" y2="256" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="347" y1="256" x2="367" y2="256" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>

  <!-- Center Text -->
  <text x="256" y="248" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="56" fill="#ffffff" letter-spacing="2">CS2</text>
  <text x="256" y="282" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#a1a1aa" letter-spacing="5">FREITAG</text>
  <circle cx="256" cy="302" r="3.5" fill="#f97316"/>
</svg>`;

async function main() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write icon.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);

  // 2. Generate PNGs using Sharp
  const svgBuffer = Buffer.from(svgIcon);
  const maskableBuffer = Buffer.from(maskableSvg);

  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(svgBuffer).resize(48, 48).png().toFile(path.join(publicDir, 'favicon.ico'));
  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  console.log('Icons successfully generated!');
}

main().catch(console.error);
