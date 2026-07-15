async function run() {
  const response = await fetch('http://localhost:3000/api/compile-scad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scadCode: 'cube([10, 10, 10]);' })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferStr = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    bufferStr += decoder.decode(value, { stream: true });
    console.log("Chunk:", bufferStr);
    const lines = bufferStr.split('\n\n');
    bufferStr = lines.pop() || '';
  }
}

run();
