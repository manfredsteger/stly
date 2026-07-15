async function run() {
  const response = await fetch('http://localhost:3000/api/compile-scad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scadCode: 'cube([10, 10, 10]);' })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferStr = '';
  let stlResult = null;
  
  while (true) {
    const { done, value } = await reader.read();
    console.log("read() returned done:", done, "value length:", value ? value.length : 0);
    if (done) break;
    
    bufferStr += decoder.decode(value, { stream: true });
    const lines = bufferStr.split('\n\n');
    bufferStr = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        console.log("Processed:", data.type);
        if (data.type === 'done') {
            stlResult = 'success';
        }
      }
    }
  }
  
  console.log("Finished loop. stlResult:", stlResult);
}

run();
