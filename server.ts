import express from "express";
import path from "path";
// import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for AI print check proxy
  app.post("/api/analyze", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.json({ analysis: "Kein API Key konfiguriert. Bitte setzen Sie GEMINI_API_KEY." });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const { stats } = req.body;
      if (!stats) {
        return res.status(400).json({ error: "Mesh stats are required" });
      }

      const prompt = `Analysiere dieses STL-Modell für den 3D-Druck:
- Dreiecke: ${stats.triangleCount}
- Maße: ${stats.boundingBox.size.x.toFixed(1)}x${stats.boundingBox.size.y.toFixed(1)}x${stats.boundingBox.size.z.toFixed(1)}mm
Gib eine kurze Einschätzung auf Deutsch (max 2 Sätze) zur Druckbarkeit.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ analysis: response.text || "Keine Analyse möglich." });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze model" });
    }
  });

  
  // API Route for SCAD to STL compilation
  const jobs = new Map();
let jobIdCounter = 0;

app.post("/api/compile-scad", async (req, res) => {
    const { scadCode } = req.body;
    if (!scadCode) {
      return res.status(400).json({ error: "scadCode is required" });
    }

    const workerCode = `
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
    `;

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
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
