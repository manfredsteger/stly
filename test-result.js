async function run() {
  const response = await fetch('http://localhost:3000/api/compile-scad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scadCode: 'cube([10, 10, 10]);' })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferStr = '';
  let jobId = null;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bufferStr += decoder.decode(value, { stream: true });
    const lines = bufferStr.split('\n\n');
    bufferStr = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.substring(6));
        if (data.type === 'done') {
            jobId = data.jobId;
        }
      }
    }
  }
  
  console.log("Got jobId:", jobId);
  if (jobId) {
    const res = await fetch(`http://localhost:3000/api/compile-result/${jobId}`);
    console.log("Result status:", res.status);
    const buf = await res.arrayBuffer();
    console.log("Result buffer size:", buf.byteLength);
  }
}

run();
