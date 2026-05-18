const https = require('https');

https.get('https://api.usesocialpulse.com/health', (res) => {
  console.log('Status Code:', res.statusCode);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
}).on('error', (e) => {
  console.error('Error:', e.message);
});

https.get('https://api.usesocialpulse.com/api/health', (res) => {
    console.log('API Status Code:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('API Response:', data));
  }).on('error', (e) => {
    console.error('Error:', e.message);
  });
