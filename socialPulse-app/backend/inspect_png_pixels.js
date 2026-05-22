const sharp = require('sharp');
const path = require('path');

const platformsDir = 'c:/Users/Venon/OneDrive/SocialPulse/socialPulse-1/socialPulse-app/frontend/public/icons/platforms';

async function checkPixel(filename) {
  const filePath = path.join(platformsDir, filename);
  const image = sharp(filePath);
  const metadata = await image.metadata();
  console.log(`=== ${filename} ===`);
  console.log(`Size: ${metadata.width}x${metadata.height}`);
  
  // Resize to 10x10 and get raw pixel buffer
  const { data } = await image.resize(10, 10, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  
  // Print pixel colors at corner (0,0) and center (5,5)
  // Each pixel is R, G, B, A (or R, G, B if no alpha)
  const channels = data.length / 100;
  console.log(`Channels: ${channels}`);
  
  const cornerR = data[0];
  const cornerG = data[1];
  const cornerB = data[2];
  const cornerA = channels === 4 ? data[3] : 255;
  console.log(`Corner (resize 10x10, 0,0): RGB = (${cornerR}, ${cornerG}, ${cornerB}), Alpha = ${cornerA}`);
  
  const centerIdx = (5 * 10 + 5) * channels;
  const centerR = data[centerIdx];
  const centerG = data[centerIdx + 1];
  const centerB = data[centerIdx + 2];
  const centerA = channels === 4 ? data[centerIdx + 3] : 255;
  console.log(`Center (resize 10x10, 5,5): RGB = (${centerR}, ${centerG}, ${centerB}), Alpha = ${centerA}`);
}

async function run() {
  await checkPixel('facebook.png');
  await checkPixel('facebook.jpeg');
}

run().catch(console.error);
