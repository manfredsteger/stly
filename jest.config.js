export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', { useESM: true, isolatedModules: true }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(three|three-bvh-csg|three-mesh-bvh|@testing-library|uuid)/)'
  ]
};
