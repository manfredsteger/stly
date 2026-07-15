const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /\{loadingProgress\}%/g,
    '{Math.round(loadingProgress)}%'
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed progress display');
