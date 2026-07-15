const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const updatedDoneLogic = `
                    } else if (data.type === 'done') {
                      setLoadingProgress(100);
                      
                      const stlRes = await fetch(\`/api/compile-result/\${data.jobId}\`);
                      if (!stlRes.ok) throw new Error("Fehler beim Herunterladen des STLs");
                      buffer = await stlRes.arrayBuffer();
                      stlResult = "success";
                      
                    } else if (data.type === 'error') {
`;

code = code.replace(
    /\} else if \(data\.type === 'done'\) \{[\s\S]*?\} else if \(data\.type === 'error'\) \{/,
    updatedDoneLogic
);

code = code.replace(
    /const encoder = new TextEncoder\(\);\s*buffer = encoder\.encode\(stlResult\)\.buffer;/,
    "" // We already set buffer
);

fs.writeFileSync('App.tsx', code);
console.log('Patched App.tsx arrayBuffer');
