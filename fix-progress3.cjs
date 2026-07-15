const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /\s*\/\/ Start an asymptotic progress timer to show activity\s*const progressTimer = setInterval\(\(\) => \{\s*setLoadingProgress\(prev => \{\s*if \(prev === null\) return null;\s*if \(prev >= 95\) return 95;\s*const inc = \(95 - prev\) \* 0\.05;\s*return prev \+ Math\.max\(0\.1, inc\);\s*\}\);\s*\}, 500\);/,
    ""
);

fs.writeFileSync('App.tsx', code);
console.log('Removed duplicate progressTimer');
