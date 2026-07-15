const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(/material: new THREE\.MeshStandardMaterial\(\{\s*color: getHighContrastColor\(\),\s*roughness: 0\.4,\s*metalness: 0\.1,\s*side: THREE\.DoubleSide\s*\}\),/g, 'color: getHighContrastColor(),');

fs.writeFileSync('App.tsx', code);
console.log('Fixed material to color');
