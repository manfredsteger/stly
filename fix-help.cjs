const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

// 1. Add HelpCircle to imports
code = code.replace(
    /import \{ Upload, Download, Box, Activity, Package, Scissors, Sparkles, Move, Layers, UploadCloud, Undo2, Redo2, Lock, Unlock \} from 'lucide-react';/,
    "import { Upload, Download, Box, Activity, Package, Scissors, Sparkles, Move, Layers, UploadCloud, Undo2, Redo2, Lock, Unlock, HelpCircle } from 'lucide-react';"
);

// 2. Import HelpModal
code = code.replace(
    /import Controls from '\.\/components\/Controls';/,
    "import Controls from './components/Controls';\nimport { HelpModal } from './components/HelpModal';"
);

// 3. Add isHelpOpen state
code = code.replace(
    /const \[isProcessing, setIsProcessing\] = useState\(false\);/,
    "const [isProcessing, setIsProcessing] = useState(false);\n  const [isHelpOpen, setIsHelpOpen] = useState(false);"
);

// 4. Add Help button and modal to render
const helpButton = `
            <button 
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center justify-center bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 w-10 h-10 rounded-2xl shadow-2xl transition-all hover:border-slate-500/50 text-slate-300 hover:text-white"
                title="Hilfe & Tastaturkürzel"
            >
                <HelpCircle size={18} />
            </button>
            <div className="flex items-center bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl p-1 overflow-hidden">
`;

code = code.replace(
    /<div className="flex items-center bg-slate-900\/80 backdrop-blur-xl border border-slate-800\/50 rounded-2xl shadow-2xl p-1 overflow-hidden">/,
    helpButton
);

const modalRender = `
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
      
      <main className="flex-1 relative bg-slate-950">
`;

code = code.replace(
    /<main className="flex-1 relative bg-slate-950">/,
    modalRender
);


fs.writeFileSync('App.tsx', code);
console.log('App updated with Help modal');
