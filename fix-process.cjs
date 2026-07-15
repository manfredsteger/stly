const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const regex = /const processFile = async \(file: File\) => \{[\s\S]*?const handleFileUpload = async/m;
const match = code.match(regex);
if (match) {
    let processFileStr = match[0];
    
    // Replace the start
    processFileStr = processFileStr.replace(
        /setLoadingText\(`Lade \$\{file\.name\}\.\.\.`\);\s*setLoadingProgress\(0\);/,
        `setLoadingText(\`Lade \${file.name}...\`);\n    setLoadingProgress(0);\n    const progressTimer = setInterval(() => {\n        setLoadingProgress(prev => {\n            if (prev === null) return null;\n            if (prev >= 95) return 95;\n            return prev + Math.max(0.1, (95 - prev) * 0.05);\n        });\n    }, 500);`
    );
    
    // Replace the fallback loading progress
    processFileStr = processFileStr.replace(
        /setLoadingProgress\(prev => prev \? Math\.min\(prev \+ 1, 85\) : 5\);/,
        `// Using interval for progress`
    );

    // Replace the finally block
    processFileStr = processFileStr.replace(
        /finally \{\s*setIsProcessing\(false\);\s*setLoadingText\(null\);\s*setLoadingProgress\(null\);\s*\}/,
        `finally {\n        clearInterval(progressTimer);\n        setIsProcessing(false);\n        setLoadingText(null);\n        setLoadingProgress(null);\n    }`
    );

    code = code.replace(regex, processFileStr);
    fs.writeFileSync('App.tsx', code);
    console.log('App updated with simulated progress in processFile');
} else {
    console.log("Could not find processFile");
}
