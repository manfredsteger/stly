const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
    /res\.flushHeaders\(\);/,
    "res.flushHeaders();\n    req.setTimeout(0);"
);

fs.writeFileSync('server.ts', code);
console.log('Patched timeout');
