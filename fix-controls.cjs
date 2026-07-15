const fs = require('fs');
let code = fs.readFileSync('components/Controls.tsx', 'utf-8');

code = code.replace(
    /onGroupObjects: \(\) => void;/,
    "onGroupObjects: () => void;\n  onUngroupObjects: () => void;"
);

const ungroupBtn = `
           {selectedObj.originalParts && selectedObj.originalParts.length > 0 && (
             <div className="mb-3">
               <button 
                  onClick={props.onUngroupObjects}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2"
               >
                  <Package size={12} />
                  Gruppierung aufheben
               </button>
             </div>
           )}
           <div className="flex bg-slate-900/50 p-1 rounded-lg gap-1 border border-slate-700/30 mb-3">
`;

code = code.replace(
    /<div className="flex bg-slate-900\/50 p-1 rounded-lg gap-1 border border-slate-700\/30 mb-3">/,
    ungroupBtn
);

fs.writeFileSync('components/Controls.tsx', code);
console.log('Controls ungroup button added');
