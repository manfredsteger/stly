const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const sseStart = "res.flushHeaders();";
const sseEnd = "worker.postMessage({ scadCode });";

if (code.includes(sseStart) && code.includes(sseEnd)) {
    code = code.replace(sseStart, sseStart + "\n    const pingInterval = setInterval(() => res.write(': ping\\n\\n'), 5000);");
    code = code.replace(/worker\.terminate\(\);/g, "clearInterval(pingInterval); worker.terminate();");
    code = code.replace(/res\.write\(\`data: \$\{JSON\.stringify\(\{ type: 'error', error: err\.message \}\)\}\\n\\n\`\);\n\s*res\.end\(\);/g, "clearInterval(pingInterval); res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\\n\\n`); res.end();");
    
    fs.writeFileSync('server.ts', code);
    console.log('Added ping interval to server.ts');
} else {
    console.log('Could not find injection points');
}
