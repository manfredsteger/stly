const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const newServerCode = `
app.post("/api/compile-scad", async (req, res) => {
    const { scadCode } = req.body;
    if (!scadCode) {
      return res.status(400).json({ error: "scadCode is required" });
    }

    const workerCode = \`
      import { parentPort } from 'worker_threads';
      import { createOpenSCAD } from 'openscad-wasm-prebuilt';

      parentPort.on('message', async (msg) => {
          try {
              const { scadCode } = msg;
              const instance = await createOpenSCAD();
              const stl = await instance.renderToStl(scadCode);
              parentPort.postMessage({ type: 'done', stl });
          } catch(err) {
              parentPort.postMessage({ type: 'error', error: err.message || err.toString() });
          }
      });
    \`;

    const { Worker } = await import('worker_threads');
    const worker = new Worker(workerCode, { eval: true });

    worker.on('message', (msg) => {
        if (msg.type === 'done') {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(msg.stl);
            worker.terminate();
        } else if (msg.type === 'error') {
            res.status(500).json({ error: msg.error });
            worker.terminate();
        }
    });

    worker.on('error', (err) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
        worker.terminate();
    });

    worker.on('exit', (code) => {
        if (code !== 0 && !res.headersSent) {
            res.status(500).json({ error: 'Worker exited with code ' + code });
        }
    });

    worker.postMessage({ scadCode });
});
`;

code = code.replace(
    /app\.post\("\/api\/compile-scad", async \(req, res\) => \{[\s\S]*?app\.get\("\/api\/compile-result\/:jobId", \(req, res\) => \{[\s\S]*?\}\);/,
    newServerCode.trim()
);

fs.writeFileSync('server.ts', code);
console.log("Patched server API");
