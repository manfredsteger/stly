const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/compile-scad',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  res.on('data', (d) => {
    process.stdout.write(d.toString());
  });
  res.on('end', () => {
    console.log('\nResponse ended.');
  });
});

req.on('error', (e) => {
  console.error('problem with request:', e.message);
});

req.write(JSON.stringify({ scadCode: 'cube([10, 10, 10]);' }));
req.end();
