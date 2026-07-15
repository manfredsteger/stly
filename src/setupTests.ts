import '@testing-library/jest-dom';

// Polyfill ResizeObserver which might be used by React components or Three
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
