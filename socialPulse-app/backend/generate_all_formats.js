const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const brainDir = 'C:/Users/Venon/.gemini/antigravity/brain/38a15833-6e2e-4023-bb56-dc8325f67185';
const outputDir = 'c:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/socialPulse-app/frontend/public/icons/platforms';

const circleMask = Buffer.from(
  `<svg width="1024" height="1024">
    <circle cx="512" cy="512" r="496" fill="black" />
  </svg>`
);

const tiktokMask = Buffer.from(
  `<svg width="1024" height="1024">
    <rect x="24" y="24" width="976" height="976" rx="200" ry="200" fill="black" />
  </svg>`
);

async function processIconBothFormats(filename, mask, baseName) {
  const inputPath = path.join(brainDir, filename);
  
  // 1. Process as transparent PNG
  const pngPath = path.join(outputDir, `${baseName}.png`);
  await sharp(inputPath)
    .ensureAlpha()
    .composite([{
      input: mask,
      blend: 'dest-in'
    }])
    .png({ quality: 100 })
    .toFile(pngPath);
  console.log(`Generated ${baseName}.png`);

  // 2. Process as JPEG with white background
  const jpegPath = path.join(outputDir, `${baseName}.jpeg`);
  
  // To create a JPEG with a white background:
  // First mask it with transparent background, then flatten onto white background, then output JPEG
  await sharp(inputPath)
    .ensureAlpha()
    .composite([{
      input: mask,
      blend: 'dest-in'
    }])
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 95 })
    .toFile(jpegPath);
  console.log(`Generated ${baseName}.jpeg`);
}

async function run() {
  // Facebook
  await processIconBothFormats('media__1779441708953.jpg', circleMask, 'facebook');
  // LinkedIn
  await processIconBothFormats('media__1779441708959.jpg', circleMask, 'linkedin');
  // Instagram
  await processIconBothFormats('media__1779441708964.jpg', circleMask, 'instagram');
  // TikTok
  await processIconBothFormats('media__1779441708968.jpg', tiktokMask, 'tiktok');
}

run().catch(err => {
  console.error('Error generating icons:', err);
});
