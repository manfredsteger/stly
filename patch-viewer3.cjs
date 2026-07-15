const fs = require('fs');
let code = fs.readFileSync('components/Viewer.tsx', 'utf-8');

code = code.replace(
    /multiSelectGroupRef\.current\.position\.copy\(center\);/,
    "while(multiSelectGroupRef.current.children.length > 0){ multiSelectGroupRef.current.remove(multiSelectGroupRef.current.children[0]); }\n        multiSelectGroupRef.current.position.copy(center);"
);

// We should also clear it when detach
code = code.replace(
    /\} else if \(state\.selectedId && !state\.measure\?\.enabled\) \{/,
    "} else if (state.selectedId && !state.measure?.enabled) {\n        while(multiSelectGroupRef.current && multiSelectGroupRef.current.children.length > 0){ multiSelectGroupRef.current.remove(multiSelectGroupRef.current.children[0]); }"
);

fs.writeFileSync('components/Viewer.tsx', code);
console.log("Patched clearing group");
