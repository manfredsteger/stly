const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /} catch \(err\) {/g,
    "} catch (err: any) {"
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed typescript');
