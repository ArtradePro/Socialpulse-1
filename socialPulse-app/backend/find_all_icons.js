const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        searchDir(fullPath);
      }
    } else {
      if (file.toLowerCase().includes('facebook') || file.toLowerCase() === 'brandicons.tsx') {
        console.log(`Found file: ${fullPath}`);
      }
    }
  });
}

searchDir('c:/Users/Venon/OneDrive/SocialPulse/socialPulse-1');
