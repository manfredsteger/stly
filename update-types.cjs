const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf-8');

code = code.replace(
    /stats: MeshStats;\n\}/,
    "stats: MeshStats;\n  originalParts?: SceneObject[];\n}"
);

fs.writeFileSync('types.ts', code);
console.log('Updated types.ts');
