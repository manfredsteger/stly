const getHighContrastColor = () => {
  const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const darkColors = ['#38bdf8', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#e2e8f0'];
  const lightColors = ['#0284c7', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#475569'];
  const palette = isDark ? darkColors : lightColors;
  return palette[Math.floor(Math.random() * palette.length)];
};
console.log(getHighContrastColor());
