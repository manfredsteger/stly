const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const updatedScadLogic = `
        if (file.name.toLowerCase().endsWith('.scad')) {
          setLoadingText(\`Kompiliere \${file.name} (OpenSCAD)...\`);
          try {
            const scadCode = await file.text();
            const response = await fetch('/api/compile-scad', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scadCode })
            });
            
            if (!response.ok) {
              let errorMsg = \`HTTP Error \${response.status}\`;
              try {
                  const errorData = await response.json();
                  errorMsg = errorData.error || errorMsg;
              } catch(e) {}
              throw new Error(errorMsg);
            }
            
            buffer = await response.arrayBuffer();
          } catch (err: any) {
            console.error("Error compiling SCAD:", err);
            setErrorMsg(\`Fehler beim Kompilieren von "\${file.name}": \${err.message || err.toString()}\`);
            return;
          }
        } else if (file.name.toLowerCase().endsWith('.stl')) {
`;

code = code.replace(
    /if \(file\.name\.toLowerCase\(\)\.endsWith\('\.scad'\)\) \{[\s\S]*?\} else if \(file\.name\.toLowerCase\(\)\.endsWith\('\.stl'\)\) \{/,
    updatedScadLogic
);

fs.writeFileSync('App.tsx', code);
console.log("Patched App.tsx for SCAD API");
