const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /let data; try \{ data = JSON\.parse\(line\.substring\(6\)\); \} catch\(e\) \{ continue; \}/,
    "let data; try { data = JSON.parse(line.substring(6)); } catch(e) { console.error('JSON parse error:', e, 'Line length:', line.length); continue; }"
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed json log');
