const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const updatedProgressEffect = `
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isProcessing && loadingProgress !== null && loadingProgress < 90) {
      timer = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev === null) return null;
          // Asymptotic progress towards 90%
          const remaining = 90 - prev;
          const step = Math.max(0.5, remaining * 0.05);
          return Math.min(90, prev + step);
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isProcessing, loadingProgress]);

  useEffect(() => {
`;

code = code.replace(
    /useEffect\(\(\) => \{\n\s*const handleGlobalClick = \(\) => \{/,
    updatedProgressEffect.trim() + '\n    const handleGlobalClick = () => {'
);

fs.writeFileSync('App.tsx', code);
console.log('Patched timer');
