
const f1 = { mimeType: 'image/jpeg' };
const f2 = { mimeType: undefined };
const f3 = { mimeType: null };
const f4 = {};

const isImage = (f) => (f.mimeType || '').startsWith('image/');

console.log('f1:', isImage(f1));
console.log('f2:', isImage(f2));
console.log('f3:', isImage(f3));
console.log('f4:', isImage(f4));
