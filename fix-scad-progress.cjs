const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const replacement = `
                    if (data.type === 'progress') {
                      const txt = data.text.trim();
                      if (txt) {
                          // Display everything from OpenSCAD so the user sees activity
                          setLoadingText(\`OpenSCAD: \${txt.substring(0, 60)}\`);
                          
                          if (txt.includes('Parsing')) setLoadingProgress(10);
                          else if (txt.includes('Compiling')) setLoadingProgress(20);
                          else if (txt.includes('Normalized')) setLoadingProgress(30);
                          else if (txt.includes('CGAL cache')) setLoadingProgress(50);
                          else if (txt.includes('CGAL Polyhedrons')) setLoadingProgress(55);
                          else if (txt.includes('CGAL')) setLoadingProgress(60);
                          else if (txt.includes('rendering time')) setLoadingProgress(90);
                          else if (txt.includes('Top level object')) setLoadingProgress(95);
                          else {
                              // Slowly increment progress to indicate activity
                              setLoadingProgress(prev => prev ? Math.min(prev + 0.2, 94) : 5);
                          }
                      }
                    } else if (data.type === 'done') {
`;

code = code.replace(
    /if \(data\.type === 'progress'\) \{[\s\S]*?\} else if \(data\.type === 'done'\) \{/,
    replacement
);

fs.writeFileSync('App.tsx', code);
console.log('Fixed OpenSCAD progress logging');
