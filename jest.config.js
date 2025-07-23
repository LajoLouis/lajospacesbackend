module.exports = {
  // Test environment
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts'
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform files
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020',
        lib: ['es2020'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true
      }
    }]
  },

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1'
  },

  // Setup files (temporarily disabled)
  // setupFilesAfterEnv: [
  //   '<rootDir>/tests/setup/jest.setup.ts'
  // ],

  // Global setup and teardown (temporarily disabled)
  // globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  // globalTeardown: '<rootDir>/tests/setup/globalTeardown.ts',

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/server.ts',
    '!src/scripts/**',
    '!src/types/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Test timeout
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Test result processor
  testResultsProcessor: undefined,

  // Watch plugins (disabled - packages not installed)
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname'
  // ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],

  // Module paths
  modulePaths: ['<rootDir>/src'],

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Max workers for parallel testing
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '<rootDir>/.jest-cache',

  // Globals for TypeScript (moved to transform configuration above)
  // globals: {
  //   'ts-jest': {
  //     tsconfig: {
  //       compilerOptions: {
  //         module: 'commonjs',
  //         target: 'es2020',
  //         lib: ['es2020'],
  //         allowJs: true,
  //         skipLibCheck: true,
  //         esModuleInterop: true,
  //         allowSyntheticDefaultImports: true,
  //         strict: true,
  //         forceConsistentCasingInFileNames: true,
  //         moduleResolution: 'node',
  //         resolveJsonModule: true,
  //         isolatedModules: true,
  //         noEmit: true,
  //         experimentalDecorators: true,
  //         emitDecoratorMetadata: true
  //       }
  //     }
  //   }
  // },

  // Test environment options
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};
