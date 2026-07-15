const fs = require('fs');
let code = fs.readFileSync('components/Controls.tsx', 'utf-8');

const lockWarning = `
           {selectedObj.locked && (
             <div className="mb-3 p-2 bg-amber-900/20 border border-amber-800/50 rounded-lg text-[10px] text-amber-200 flex items-center justify-center gap-2">
                <Lock size={12} />
                Objekt ist gesperrt.
             </div>
           )}
           <div className={\`flex bg-slate-900/50 p-1 rounded-lg gap-1 border border-slate-700/30 mb-3 \${selectedObj.locked ? 'opacity-50 pointer-events-none' : ''}\`}>
`;

code = code.replace(
    /<div className="flex bg-slate-900\/50 p-1 rounded-lg gap-1 border border-slate-700\/30 mb-3">/,
    lockWarning
);

fs.writeFileSync('components/Controls.tsx', code);
console.log('Controls updated with lock warning');
