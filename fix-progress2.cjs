const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /if \(prev >= 95\) return 95;/,
    "if (prev >= 95) return prev;"
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed progress downgrade');
