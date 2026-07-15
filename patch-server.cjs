const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
    /worker\.on\('error', \(err\) => \{[\s\S]*?\}\);/,
    `worker.on('error', (err) => {
      clearInterval(pingInterval); 
      res.write(\`data: \${JSON.stringify({ type: 'error', error: err.message })}\\n\\n\`); 
      res.end();
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
          clearInterval(pingInterval); 
          res.write(\`data: \${JSON.stringify({ type: 'error', error: 'Worker exited with code ' + code })}\\n\\n\`); 
          res.end();
      }
    });`
);

fs.writeFileSync('server.ts', code);
console.log('Patched server exit handler');
