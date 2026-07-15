const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const newServerCode = `
const jobs = new Map();
let jobIdCounter = 0;

app.post("/api/compile-scad", async (req, res) => {
    const { scadCode } = req.body;
    if (!scadCode) {
      return res.status(400).json({ error: "scadCode is required" });
    }

    const jobId = String(++jobIdCounter);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    req.setTimeout(0);
    const pingInterval = setInterval(() => res.write(': ping\\n\\n'), 5000);
    
    const workerCode = \`
      import { parentPort } from 'worker_threads';
      import { createOpenSCAD } from 'openscad-wasm-prebuilt';

      parentPort.on('message', async (msg) => {
          try {
              const { scadCode } = msg;
              const instance = await createOpenSCAD({
                  print: (text) => parentPort.postMessage({ type: 'progress', text }),
                  printErr: (text) => parentPort.postMessage({ type: 'progress', text })
              });
              const stl = await instance.renderToStl(scadCode);
              parentPort.postMessage({ type: 'done', stl });
          } catch(err) {
              parentPort.postMessage({ type: 'error', error: err.message || err.toString() });
          }
      });
    \`;

    const { Worker } = await import('worker_threads');
    const worker = new Worker(workerCode, { eval: true });

    req.on('close', () => {
      clearInterval(pingInterval);
      worker.terminate();
    });
    
    worker.on('message', (msg) => {
      try {
          if (msg.type === 'progress') {
            res.write(\`data: \${JSON.stringify({ type: 'progress', text: msg.text })}\\n\\n\`);
          } else if (msg.type === 'done') {
            jobs.set(jobId, msg.stl);
            res.write(\`data: \${JSON.stringify({ type: 'done', jobId })}\\n\\n\`);
            res.end();
            clearInterval(pingInterval); worker.terminate();
            // cleanup job after 5 minutes
            setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
          } else if (msg.type === 'error') {
            res.write(\`data: \${JSON.stringify({ type: 'error', error: msg.error })}\\n\\n\`);
            res.end();
            clearInterval(pingInterval); worker.terminate();
          }
      } catch (err) {
          console.error("Error sending message to client:", err);
          clearInterval(pingInterval); worker.terminate();
          res.end();
      }
    });

    worker.on('error', (err) => {
      clearInterval(pingInterval); 
      res.write(\`data: \${JSON.stringify({ type: 'error', error: err.message })}\\n\\n\`); 
      res.end();
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
          clearInterval(pingInterval); 
          res.write(\`data: \${JSON.stringify({ type: 'error', error: 'Worker exited with code ' + code })}\\n\\n\`); 
          res.end();
      }
    });

    worker.postMessage({ scadCode });
});

app.get("/api/compile-result/:jobId", (req, res) => {
    const stl = jobs.get(req.params.jobId);
    if (!stl) {
        return res.status(404).send("Job not found or expired");
    }
    jobs.delete(req.params.jobId); // single use
    res.setHeader('Content-Type', 'model/stl');
    res.send(stl);
});
`;

code = code.replace(
    /app\.post\("\/api\/compile-scad", async \(req, res\) => \{[\s\S]*?worker\.postMessage\(\{ scadCode \}\);\n  \}\);/,
    newServerCode.trim()
);

fs.writeFileSync('server.ts', code);
console.log('Patched server for job id');
