const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const insertion = `
    const pingInterval = setInterval(() => res.write(': ping\\n\\n'), 5000);
    req.on('close', () => {
      clearInterval(pingInterval);
      worker.terminate();
    });
`;

code = code.replace(
    /const pingInterval = setInterval\(\(\) => res\.write\(': ping\\n\\n'\), 5000\);/,
    insertion.trim()
);

fs.writeFileSync('server.ts', code);
console.log('Added req.on close handler');
