const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const replacement = `
                    if (data.type === 'progress') {
                      const txt = data.text;
                      
                      // Filter noisy logs
                      if (!txt.includes('localization') && !txt.includes('cache size') && !txt.includes('Geometries in cache') && !txt.includes('CGAL Polyhedrons')) {
                          if (txt.includes('Parsing')) { setLoadingText('Analysiere SCAD-Code...'); setLoadingProgress(10); }
                          else if (txt.includes('Compiling')) { setLoadingText('Kompiliere Geometrie...'); setLoadingProgress(20); }
                          else if (txt.includes('Normalized')) { setLoadingText('Normalisiere Mesh...'); setLoadingProgress(30); }
                          else if (txt.includes('CGAL')) { setLoadingText('Berechne Boolesche Operationen...'); setLoadingProgress(60); }
                          else if (txt.includes('rendering time')) { setLoadingText('Schließe Rendering ab...'); setLoadingProgress(90); }
                          else if (txt.includes('Top level object')) { setLoadingText('Generiere STL...'); setLoadingProgress(95); }
                          else {
                              // Show other progress messages directly to reassure user
                              if (txt.trim()) {
                                  setLoadingText(\`OpenSCAD: \${txt.trim().substring(0, 50)}\`);
                                  setLoadingProgress(prev => prev ? Math.min(prev + 1, 94) : 5);
                              }
                          }
                      }
                    } else if (data.type === 'done') {
`;

code = code.replace(
    /if \(data\.type === 'progress'\) \{[\s\S]*?\} else if \(data\.type === 'done'\) \{/,
    replacement
);

fs.writeFileSync('App.tsx', code);
console.log('Progress logging enhanced');
