const fs = require('fs');
let code = fs.readFileSync('components/Viewer.tsx', 'utf-8');

const replacement = `
    if (transformControlsRef.current) {
      if (state.selectedId && !state.measure?.enabled) {
        const selectedObj = state.objects.find(o => o.id === state.selectedId);
        const activeMesh = objectsGroupRef.current.children.find(c => c.userData?.id === state.selectedId);
        if (activeMesh && selectedObj && !selectedObj.locked) {
          if (transformControlsRef.current.object !== activeMesh) {
            transformControlsRef.current.attach(activeMesh);
          }
        } else {
          transformControlsRef.current.detach();
        }
      } else {
        transformControlsRef.current.detach();
      }
    }
`;

code = code.replace(
    /if \(transformControlsRef\.current\) \{\s*if \(state\.selectedId && !state\.measure\?\.enabled\) \{\s*const activeMesh = objectsGroupRef\.current\.children\.find\(c => c\.userData\?\.id === state\.selectedId\);\s*if \(activeMesh\) \{\s*if \(transformControlsRef\.current\.object !== activeMesh\) \{\s*transformControlsRef\.current\.attach\(activeMesh\);\s*\}\s*\} else \{\s*transformControlsRef\.current\.detach\(\);\s*\}\s*\} else \{\s*transformControlsRef\.current\.detach\(\);\s*\}\s*\}/,
    replacement
);

fs.writeFileSync('components/Viewer.tsx', code);
console.log('Viewer updated with lock logic');
