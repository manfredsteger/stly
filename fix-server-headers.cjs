const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
    /res\.setHeader\('Connection', 'keep-alive'\);/,
    "res.setHeader('Connection', 'keep-alive');\n    res.setHeader('X-Accel-Buffering', 'no');"
);

fs.writeFileSync('server.ts', code);
console.log('Added X-Accel-Buffering no');
