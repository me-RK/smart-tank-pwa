// Simple icon generation script for PWA
// This script creates basic icon files for the PWA

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple SVG icon
const createSVGIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad1)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" text-anchor="middle" dy="0.35em" fill="white">WT</text>
</svg>`;
};

// Create a simple PNG-like data URL (base64 encoded SVG)
const createPNGDataURL = (size) => {
  const svg = createSVGIcon(size);
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
};

// Icon sizes needed for PWA
const iconSizes = [
  { size: 16, name: 'icon-16.png' },
  { size: 32, name: 'icon-32.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' }
];

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate icon files
iconSizes.forEach(({ size, name }) => {
  const svgContent = createSVGIcon(size);
  const filePath = path.join(publicDir, name.replace('.png', '.svg'));
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`Generated ${name.replace('.png', '.svg')} (${size}x${size})`);
});

// Create splash screen images (simple colored rectangles)
const splashSizes = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },
  { width: 750, height: 1334, name: 'splash-750x1334.png' },
  { width: 1242, height: 2208, name: 'splash-1242x2208.png' },
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' }
];

splashSizes.forEach(({ width, height, name }) => {
  const svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f0f9ff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e0f2fe;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#splashGrad)"/>
  <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height) * 0.1}" fill="#3b82f6"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.08}" font-weight="bold" text-anchor="middle" dy="0.35em" fill="white">WT</text>
</svg>`;
  
  const filePath = path.join(publicDir, name.replace('.png', '.svg'));
  fs.writeFileSync(filePath, svgContent);
  console.log(`Generated ${name.replace('.png', '.svg')} (${width}x${height})`);
});

console.log('\nIcon generation complete!');
console.log('Note: These are SVG files. For production, you should convert them to PNG format.');
console.log('You can use online tools like https://convertio.co/svg-png/ or ImageMagick to convert them.');
