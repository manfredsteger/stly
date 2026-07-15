const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const updatedErrorHandling = `
            if (!response.ok) {
              let errorMsg = \`HTTP Error \${response.status}\`;
              try {
                  const errorData = await response.json();
                  errorMsg = errorData.error || errorMsg;
              } catch(e) {}
              throw new Error(errorMsg);
            }
`;

code = code.replace(
    /if \(!response\.ok\) \{\s*const errorData = await response\.json\(\);\s*throw new Error\(errorData\.error \|\| "SCAD Compilation failed"\);\s*\}/,
    updatedErrorHandling.trim()
);

code = code.replace(
    /if \(!stlResult\) throw new Error\("Kein STL generiert\."\);/,
    'if (!stlResult) throw new Error("Verbindung zum Server unterbrochen, bevor das STL fertig generiert wurde (Kein STL).");'
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed error handling');
