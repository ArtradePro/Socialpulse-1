const sharp = require('sharp');
const path = require('path');

const brainDir = 'C:/Users/Venon/.gemini/antigravity/brain/38a15833-6e2e-4023-bb56-dc8325f67185';

async function checkPixel(filename) {
  const filePath = path.join(brainDir, filename);
  const image = sharp(filePath);
  const metadata = await image.metadata();
  console.log(`=== Brain: ${filename} ===`);
  console.log(`Size: ${metadata.width}x${metadata.height}`);
  
  const { data } = await image.resize(10, 10, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const channels = data.length / 100;
  
  const cornerR = data[0];
  const cornerG = data[1];
  const cornerB = data[2];
  console.log(`Corner (resize 10x10, 0,0): RGB = (${cornerR}, ${cornerG}, ${cornerB})`);
  
  const centerIdx = (5 * 10 + 5) * channels;
  const centerR = data[centerIdx];
  const centerG = data[centerIdx + 1];
  const centerB = data[centerIdx + 2];
  console.log(`Center (resize 10x10, 5,5): RGB = (${centerR}, ${centerG}, ${centerB})`);
}

async function run() {
  await checkPixel('media__1779441708953.jpg');
  await checkPixel('media__1779441708959.jpg');
  await checkPixel('media__1779441708964.jpg');
  await checkPixel('media__1779441708968.jpg');
}

run().catch(console.error);
