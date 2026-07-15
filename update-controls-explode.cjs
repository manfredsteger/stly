const fs = require('fs');
let code = fs.readFileSync('components/Controls.tsx', 'utf-8');

code = code.replace(
    /onMergeObjects: \(\) => void;/,
    "onMergeObjects: () => void;\n  onExplodeView: () => void;"
);

const explodeBtn = `
           <div className="mt-4 pt-4 border-t border-slate-700/50">
               <button 
                  onClick={props.onExplodeView}
                  disabled={state.objects.filter(o => o.visible).length < 2 || analyzing}
                  className="w-full py-2.5 mb-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-colors"
               >
                 <Sparkles size={14} />
                 Explosionsansicht (Sichtbare)
               </button>
               <button 
`;

code = code.replace(
    /<div className="mt-4 pt-4 border-t border-slate-700\/50">\s*<button/,
    explodeBtn
);

fs.writeFileSync('components/Controls.tsx', code);
console.log('Controls updated with explode button');
