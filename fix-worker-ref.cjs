const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Remove the old req.on('close')
code = code.replace(
    /req\.on\('close', \(\) => \{\s*clearInterval\(pingInterval\);\s*worker\.terminate\(\);\s*\}\);/,
    ""
);

// Add it after worker definition
const workerDef = "const worker = new Worker(workerCode, { eval: true });";
code = code.replace(
    workerDef,
    workerDef + "\n\n    req.on('close', () => {\n      clearInterval(pingInterval);\n      worker.terminate();\n    });"
);

fs.writeFileSync('server.ts', code);
console.log('Fixed worker reference error');
