import neostandard from 'neostandard'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import jsdoc from 'eslint-plugin-jsdoc'
import * as wdioPlugin from 'eslint-plugin-wdio'

const neostandardConfig = neostandard({
  ignores: [
    ...neostandard.resolveIgnoresFromGitignore(),
    '.server/**',
    '.public/**',
    '.vite/**',
    'coverage/**'
  ],
  ts: true
})

export default [
  ...neostandardConfig,
  {
    files: ['**/*.{js,cjs}'],
    ignores: ['**/user-journey-tests/**/*.{cjs,js}', 'src/client/**/*.js'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jsdoc
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      'no-console': 'error',

      // Turn off strict type checking rules
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // JSDoc configuration
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-param': 'off',
      'jsdoc/require-property-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: ['import', 'satisfies']
        }
      ],
      '@typescript-eslint/class-literal-property-style': 'off'
    }
  },
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['**/*.test.js', '**/*.test.cjs'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    }
  },
  {
    files: ['src/client/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        NodeList: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly'
      }
    }
  },
  {
    files: ['user-journey-tests/**/*.{js,cjs}'],
    plugins: {
      wdio: wdioPlugin
    },
    languageOptions: {
      globals: {
        $: 'readonly',
        $$: 'readonly',
        browser: 'readonly',
        driver: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      ...wdioPlugin.configs.recommended.rules,
      'no-console': 'error'
    }
  },
  prettier
]
