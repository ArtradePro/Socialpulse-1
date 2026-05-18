const https = require('https');

https.get('https://api.usesocialpulse.com/api/analytics/dashboard', (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
}).on('error', (e) => {
  console.error('Error:', e.message);
});
