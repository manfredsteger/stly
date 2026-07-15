import { Worker } from 'worker_threads';

const workerCode = `
import { parentPort } from 'worker_threads';
import { createOpenSCAD } from 'openscad-wasm-prebuilt';

async function run() {
    try {
        const instance = await createOpenSCAD({
            print: (text) => parentPort.postMessage({ type: 'progress', text }),
            printErr: (text) => parentPort.postMessage({ type: 'progress', text })
        });
        const stl = await instance.renderToStl('cube([10, 10, 10]);');
        parentPort.postMessage({ type: 'done', stl });
    } catch(err) {
        parentPort.postMessage({ type: 'error', error: err.message });
    }
}
run();
`;

const worker = new Worker(workerCode, { eval: true });
worker.on('message', msg => console.log('msg type:', msg.type));
worker.on('error', err => console.log('err:', err.message));
worker.on('exit', code => console.log('exit:', code));
