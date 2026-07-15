const { Worker, isMainThread, parentPort } = require('worker_threads');

if (isMainThread) {
  const worker = new Worker(__filename);
  worker.on('message', (msg) => {
    console.log("MAIN RECEIVED:", new Date().toISOString(), msg);
  });
} else {
  console.log("WORKER STARTED:", new Date().toISOString());
  const start = Date.now();
  let last = start;
  let count = 0;
  while (Date.now() - start < 5000) {
    if (Date.now() - last >= 1000) {
      parentPort.postMessage("Tick " + count);
      count++;
      last = Date.now();
    }
  }
  parentPort.postMessage("Done");
}
