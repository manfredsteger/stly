const { Worker } = require('worker_threads');

const workerCode = `
import { parentPort } from 'worker_threads';
parentPort.postMessage('hello');
`;

const worker = new Worker(workerCode, { eval: true });
worker.on('message', msg => console.log('msg:', msg));
worker.on('error', err => console.log('err:', err.message));
worker.on('exit', code => console.log('exit:', code));
