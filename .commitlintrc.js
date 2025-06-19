module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type enum
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation changes
        'style',    // Code style changes (formatting, etc.)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding or updating tests
        'build',    // Build system or external dependencies
        'ci',       // CI/CD changes
        'chore',    // Other changes that don't modify src or test files
        'revert',   // Revert previous commit
        'security', // Security fixes
        'deps',     // Dependency updates
        'config',   // Configuration changes
        'release'   // Release commits
      ]
    ],
    
    // Subject rules
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'subject-min-length': [2, 'always', 10],
    
    // Type rules
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    
    // Scope rules
    'scope-case': [2, 'always', 'lower-case'],
    'scope-enum': [
      2,
      'always',
      [
        'auth',        // Authentication related
        'user',        // User management
        'property',    // Property management
        'search',      // Search functionality
        'match',       // Matching system
        'message',     // Messaging system
        'notification',// Notifications
        'upload',      // File uploads
        'email',       // Email services
        'cache',       // Caching
        'session',     // Session management
        'security',    // Security features
        'performance', // Performance improvements
        'database',    // Database related
        'api',         // API changes
        'ui',          // User interface
        'config',      // Configuration
        'deps',        // Dependencies
        'test',        // Testing
        'ci',          // Continuous integration
        'docs',        // Documentation
        'build',       // Build system
        'deploy',      // Deployment
        'monitoring',  // Monitoring and logging
        'analytics',   // Analytics
        'admin',       // Admin panel
        'mobile',      // Mobile specific
        'web',         // Web specific
        'shared',      // Shared components
        'utils',       // Utilities
        'types',       // Type definitions
        'models',      // Data models
        'routes',      // API routes
        'middleware',  // Middleware
        'services',    // Services
        'controllers', // Controllers
        'validation',  // Validation
        'migration',   // Database migrations
        'seed',        // Database seeding
        'backup',      // Backup related
        'recovery',    // Recovery related
        'maintenance', // Maintenance
        'hotfix',      // Hot fixes
        'release'      // Release related
      ]
    ],
    
    // Header rules
    'header-max-length': [2, 'always', 100],
    'header-min-length': [2, 'always', 15],
    
    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
    
    // Footer rules
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
    
    // References
    'references-empty': [1, 'never'],
    
    // Signed-off-by
    'signed-off-by': [0, 'always', 'Signed-off-by:']
  },
  
  // Custom parser options
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w*)(?:\(([^)]*)\))?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
      referenceActions: [
        'close',
        'closes',
        'closed',
        'fix',
        'fixes',
        'fixed',
        'resolve',
        'resolves',
        'resolved'
      ],
      issuePrefixes: ['#'],
      noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
      fieldPattern: /^-(.*?)-$/,
      revertPattern: /^Revert\s"([\s\S]*)"\s*This reverts commit (\w*)\./,
      revertCorrespondence: ['header', 'hash'],
      warn: function() {},
      mergePattern: null,
      mergeCorrespondence: null
    }
  },
  
  // Help URL
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
  
  // Prompt settings for commitizen
  prompt: {
    questions: {
      type: {
        description: "Select the type of change that you're committing:",
        enum: {
          feat: {
            description: 'A new feature',
            title: 'Features'
          },
          fix: {
            description: 'A bug fix',
            title: 'Bug Fixes'
          },
          docs: {
            description: 'Documentation only changes',
            title: 'Documentation'
          },
          style: {
            description: 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
            title: 'Styles'
          },
          refactor: {
            description: 'A code change that neither fixes a bug nor adds a feature',
            title: 'Code Refactoring'
          },
          perf: {
            description: 'A code change that improves performance',
            title: 'Performance Improvements'
          },
          test: {
            description: 'Adding missing tests or correcting existing tests',
            title: 'Tests'
          },
          build: {
            description: 'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)',
            title: 'Builds'
          },
          ci: {
            description: 'Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)',
            title: 'Continuous Integrations'
          },
          chore: {
            description: "Other changes that don't modify src or test files",
            title: 'Chores'
          },
          revert: {
            description: 'Reverts a previous commit',
            title: 'Reverts'
          },
          security: {
            description: 'Security improvements or fixes',
            title: 'Security'
          }
        }
      },
      scope: {
        description: 'What is the scope of this change (e.g. component or file name)'
      },
      subject: {
        description: 'Write a short, imperative tense description of the change'
      },
      body: {
        description: 'Provide a longer description of the change'
      },
      isBreaking: {
        description: 'Are there any breaking changes?'
      },
      breakingBody: {
        description: 'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself'
      },
      breaking: {
        description: 'Describe the breaking changes'
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?'
      },
      issuesBody: {
        description: 'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself'
      },
      issues: {
        description: 'Add issue references (e.g. "fix #123", "re #123".)'
      }
    }
  }
};
