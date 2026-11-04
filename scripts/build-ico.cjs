const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createWindowsIco() {
  const pngPath = path.resolve('public/pwa-512x512.png');
  const faviconPngPath = path.resolve('public/favicon.png');
  const srcPath = fs.existsSync(faviconPngPath) ? faviconPngPath : (fs.existsSync(pngPath) ? pngPath : path.resolve('public/icon.svg'));

  const publicDir = path.resolve('public');
  const distDir = path.resolve('dist');

  // Helper to build native uncompressed Windows DIB ICO buffer (accepted by explorer.exe / shell32.dll)
  async function buildDibIcoBuffer(sizes) {
    const dibEntries = [];

    for (const size of sizes) {
      // Render image to raw 32-bit RGBA buffer
      const rawBuffer = await sharp(srcPath)
        .resize(size, size)
        .ensureAlpha()
        .raw()
        .toBuffer();

      // In ICO DIB format, XOR bitmap is BGRA and bottom-up
      const xorBuffer = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++) {
        const srcY = size - 1 - y; // Bottom-up
        for (let x = 0; x < size; x++) {
          const srcOffset = (srcY * size + x) * 4;
          const dstOffset = (y * size + x) * 4;
          const r = rawBuffer[srcOffset];
          const g = rawBuffer[srcOffset + 1];
          const b = rawBuffer[srcOffset + 2];
          const a = rawBuffer[srcOffset + 3];

          xorBuffer[dstOffset] = b;     // B
          xorBuffer[dstOffset + 1] = g; // G
          xorBuffer[dstOffset + 2] = r; // R
          xorBuffer[dstOffset + 3] = a; // A
        }
      }

      // AND mask (1-bit mask, 1 byte aligned to 32 bits per row)
      const andRowBytes = Math.ceil(size / 32) * 4;
      const andBuffer = Buffer.alloc(andRowBytes * size, 0x00); // 0 = opaque/use alpha channel

      // BITMAPINFOHEADER (40 bytes)
      const bih = Buffer.alloc(40);
      bih.writeUInt32LE(40, 0);                 // biSize
      bih.writeInt32LE(size, 4);                // biWidth
      bih.writeInt32LE(size * 2, 8);            // biHeight (doubled for XOR + AND)
      bih.writeUInt16LE(1, 12);                 // biPlanes
      bih.writeUInt16LE(32, 14);                // biBitCount (32-bit RGBA)
      bih.writeUInt32LE(0, 16);                 // biCompression (BI_RGB uncompressed)
      bih.writeUInt32LE(xorBuffer.length + andBuffer.length, 20); // biSizeImage
      bih.writeInt32LE(0, 24);                  // biXPelsPerMeter
      bih.writeInt32LE(0, 28);                  // biYPelsPerMeter
      bih.writeUInt32LE(0, 32);                 // biClrUsed
      bih.writeUInt32LE(0, 36);                 // biClrImportant

      const imageData = Buffer.concat([bih, xorBuffer, andBuffer]);
      dibEntries.push({ size, imageData });
    }

    const numImages = dibEntries.length;
    const headerSize = 6 + numImages * 16;

    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // ICO format
    icoHeader.writeUInt16LE(numImages, 4);

    const dirEntries = [];
    let currentOffset = headerSize;

    for (const entry of dibEntries) {
      const dirEntry = Buffer.alloc(16);
      dirEntry.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);  // Width
      dirEntry.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);  // Height
      dirEntry.writeUInt8(0, 2);                                   // Color count
      dirEntry.writeUInt8(0, 3);                                   // Reserved
      dirEntry.writeUInt16LE(1, 4);                                // Planes
      dirEntry.writeUInt16LE(32, 6);                               // Bit count
      dirEntry.writeUInt32LE(entry.imageData.length, 8);          // Bytes in res
      dirEntry.writeUInt32LE(currentOffset, 12);                   // Image offset

      dirEntries.push(dirEntry);
      currentOffset += entry.imageData.length;
    }

    return Buffer.concat([
      icoHeader,
      ...dirEntries,
      ...dibEntries.map(e => e.imageData)
    ]);
  }

  // 1. Full-resolution multi-size favicon.ico (16, 32, 48, 64)
  const fullIcoBuf = await buildDibIcoBuffer([16, 32, 48, 64]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), fullIcoBuf);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'favicon.ico'), fullIcoBuf);
  }

  // 2. Single resolution 16x16 favicon16x16.ico
  const ico16Buf = await buildDibIcoBuffer([16]);
  fs.writeFileSync(path.join(publicDir, 'favicon16x16.ico'), ico16Buf);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'favicon16x16.ico'), ico16Buf);
  }

  // 3. Single resolution 32x32 favicon32x32.ico
  const ico32Buf = await buildDibIcoBuffer([32]);
  fs.writeFileSync(path.join(publicDir, 'favicon32x32.ico'), ico32Buf);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'favicon32x32.ico'), ico32Buf);
  }

  // 4. Compact Windows launcher icon under 10KB for Start.bat (sizes 16, 32 -> 5.4 KB)
  const launcherIcoBuf = await buildDibIcoBuffer([16, 32]);
  fs.writeFileSync(path.join(publicDir, 'launcher-icon.ico'), launcherIcoBuf);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'launcher-icon.ico'), launcherIcoBuf);
  }

  // Embed the launcher icon (<10KB) base64 in src/data/embeddedIcoBase64.ts
  const base64Str = launcherIcoBuf.toString('base64');
  const targetTsPath = path.resolve('src/data/embeddedIcoBase64.ts');
  const tsContent = `// Auto-generated by scripts/build-ico.cjs - do not edit manually\nexport const FAVICON_ICO_BASE64 = '${base64Str}';\n`;
  fs.writeFileSync(targetTsPath, tsContent);

  console.log(`Generated all native DIB Windows ICO files successfully:
  - favicon.ico (${fullIcoBuf.length} bytes, native DIB)
  - favicon16x16.ico (${ico16Buf.length} bytes)
  - favicon32x32.ico (${ico32Buf.length} bytes)
  - launcher-icon.ico (${launcherIcoBuf.length} bytes, <10KB native DIB for Start.bat)`);
}

createWindowsIco().catch(err => {
  console.error('Error generating ICO files:', err);
  process.exit(1);
});
