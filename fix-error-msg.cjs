const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /const processFile = async \(file: File\) => \{/,
    "const processFile = async (file: File) => {\n    setErrorMsg(null);"
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed error msg clear');
