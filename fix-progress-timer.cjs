const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /if \(isProcessing && loadingProgress !== null && loadingProgress < 90\) \{/,
    "if (isProcessing && loadingProgress !== null && loadingProgress > 0 && loadingProgress < 90) {"
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed progress timer');
