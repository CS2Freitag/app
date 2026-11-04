import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('public/favicon.ico');
const pngBuffer = fs.readFileSync(srcPath);

// Create a valid Windows ICO file header & directory entry embedding the PNG data
const width = 48;
const height = 48;

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // Type 1 = Icon
header.writeUInt16LE(1, 4); // 1 image

const entry = Buffer.alloc(16);
entry.writeUInt8(width >= 256 ? 0 : width, 0);
entry.writeUInt8(height >= 256 ? 0 : height, 1);
entry.writeUInt8(0, 2); // Color count
entry.writeUInt8(0, 3); // Reserved
entry.writeUInt16LE(1, 4); // Planes
entry.writeUInt16LE(32, 6); // Bits per pixel
entry.writeUInt32LE(pngBuffer.length, 8); // Size
entry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

const icoBuffer = Buffer.concat([header, entry, pngBuffer]);
fs.writeFileSync(srcPath, icoBuffer);
console.log('Successfully converted public/favicon.ico to valid Windows ICO format.');
