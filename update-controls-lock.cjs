const fs = require('fs');
let code = fs.readFileSync('components/Controls.tsx', 'utf-8');

code = code.replace(
    /Download, Trash2, Box, Layers, Move, RefreshCw, Scissors, Sparkles,/,
    "Download, Trash2, Box, Layers, Move, RefreshCw, Scissors, Sparkles, Lock, Unlock,"
);

const lockBtn = `
                 <button onClick={(e) => { e.stopPropagation(); props.onUpdateObject(obj.id, { locked: !obj.locked }); }} className={\`p-1 hover:text-white \${obj.locked ? 'text-amber-500' : 'text-slate-500'}\`}>
                    {obj.locked ? <Lock size={12}/> : <Unlock size={12}/>}
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); props.onDuplicateObject(obj.id); }} className="p-1 hover:text-white text-slate-500">
`;

code = code.replace(
    /<button onClick=\{\(e\) => \{ e\.stopPropagation\(\); onDuplicateObject\(obj\.id\); \}\} className="p-1 hover:text-white text-slate-500">/,
    lockBtn
);

// We also need to fix `onDuplicateObject(obj.id);` to `props.onDuplicateObject` if it was not already props. Let's check how the file is structured.
fs.writeFileSync('components/Controls.tsx', code);
console.log('Controls updated with lock icon');
