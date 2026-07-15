const fs = require('fs');
let code = fs.readFileSync('components/Viewer.tsx', 'utf-8');

const regex = /useEffect\(\(\) => \{\s*if \(transformControlsRef\.current\) \{/;
code = code.replace(regex, `useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(state.transformMode || 'translate');`);

// We also need to add state.transformMode to the dependency array
const depRegex = /\}, \[state\.objects, state\.selectedId, state\.selectedIds, state\.measure\?\.enabled\]\);/;
code = code.replace(depRegex, '}, [state.objects, state.selectedId, state.selectedIds, state.measure?.enabled, state.transformMode]);');

fs.writeFileSync('components/Viewer.tsx', code);
console.log("Patched transform mode in Viewer");
