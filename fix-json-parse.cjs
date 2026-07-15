const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /const data = JSON\.parse\(line\.substring\(6\)\);/,
    "let data; try { data = JSON.parse(line.substring(6)); } catch(e) { continue; }"
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed JSON.parse');
