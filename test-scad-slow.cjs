const fs = require('fs');
fs.writeFileSync('test-slow.scad', 'minkowski() { cube([10,10,10]); sphere(r=2, $fn=50); }');

async function test() {
  const scadCode = fs.readFileSync('test-slow.scad', 'utf-8');
  const response = await fetch('http://localhost:3000/api/compile-scad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scadCode })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    console.log("CHUNK TIME:", new Date().toISOString(), "SIZE:", chunk.length, "CONTENT:", chunk.substring(0, 100).replace(/\n/g, '\\n'));
  }
}
test();
