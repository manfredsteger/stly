const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const newProcess = `
  const processFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setLoadingText(\`Lade \${file.name}...\`);
    setLoadingProgress(0);
    
    // Start an asymptotic progress timer to show activity
    const progressTimer = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev === null) return null;
            if (prev >= 95) return 95;
            const inc = (95 - prev) * 0.05;
            return prev + Math.max(0.1, inc);
        });
    }, 500);

    try {
`;

code = code.replace(
    /const processFile = async \(file: File\) => \{\s*setErrorMsg\(null\);\s*setIsProcessing\(true\);\s*setLoadingText\(`Lade \$\{file\.name\}\.\.\.`\);\s*setLoadingProgress\(0\);\s*try \{/,
    newProcess
);

code = code.replace(
    /setLoadingProgress\(prev => prev \? Math\.min\(prev \+ 1, 85\) : 5\);/,
    "// ignoring unmapped messages to let the interval handle progress smoothly"
);

const finallyBlock = `
    } catch (err: any) {
        console.error("File loading error:", err);
        setErrorMsg(\`Fehler beim Laden von \${file.name}: \${err.message || err.toString()}\`);
    } finally {
        clearInterval(progressTimer);
        setIsProcessing(false);
        setLoadingProgress(null);
    }
`;

code = code.replace(
    /\} catch \(err: any\) \{\s*console\.error\("File loading error:", err\);\s*setErrorMsg\(`Fehler beim Laden von \$\{file\.name\}: \$\{err\.message \|\| err\.toString\(\)\}`\);\s*\} finally \{\s*setIsProcessing\(false\);\s*setLoadingProgress\(null\);\s*\}/,
    finallyBlock
);

fs.writeFileSync('App.tsx', code);
console.log('App updated with simulated progress');
