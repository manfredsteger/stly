const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf-8');

code = code.replace(
    /visible: boolean;/,
    "visible: boolean;\n  locked?: boolean;"
);

fs.writeFileSync('types.ts', code);
console.log('Updated types.ts with locked prop');
